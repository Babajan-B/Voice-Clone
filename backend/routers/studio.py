import asyncio
import json
import os
from typing import AsyncGenerator

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

import config
from services import model_manager, history as history_svc
from services.asr_service import transcribe_sync
from services.notebooklm_service import generate_podcast_audio, is_authenticated
from services.tts_service import estimate_chunk_count, synthesize_sync
from utils.audio import cleanup_temp_file, uploaded_bytes_to_wav
from utils.errors import VoiceCloneError
from utils.voices import voice_profile_paths

router = APIRouter()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _progress(value: float, desc: str) -> str:
    return sse_event({"type": "progress", "value": value, "desc": desc})


def _result(**payload) -> str:
    return sse_event({"type": "result", **payload})


def _error(exc: Exception) -> str:
    if isinstance(exc, VoiceCloneError):
        return sse_event({"type": "error", **exc.to_payload()})
    return sse_event({"type": "error", "code": "UNKNOWN", "message": str(exc), "hint": ""})


def _done() -> str:
    return sse_event({"type": "done"})


@router.get("/studio/auth-status")
async def auth_status():
    return JSONResponse({"logged_in": is_authenticated()})


@router.post("/studio/generate")
async def studio_generate(
    sources: str = Form(...),
    instructions: str = Form(""),
    voice_name: str = Form(...),
    audio_format: str = Form("deep_dive"),
    language: str = Form("en"),
    asr_model: str = Form("base"),
    speed: float = Form(1.0),
    pitch: float = Form(0.0),
    emotion: str = Form("neutral"),
    auto_delete: bool = Form(True),
    save_history: bool = Form(True),
):
    if not is_authenticated():
        raise HTTPException(
            401,
            "Not logged into NotebookLM. Run 'notebooklm login' in your terminal.",
        )

    try:
        sources_list: list[str] = json.loads(sources)
    except Exception:
        raise HTTPException(422, "sources must be a JSON array of strings")

    sources_list = [s.strip() for s in sources_list if s.strip()]
    if not sources_list:
        raise HTTPException(422, "At least one source is required")

    try:
        safe_voice_name, ref_audio_path, ref_transcript_path = voice_profile_paths(voice_name)
    except ValueError:
        raise HTTPException(422, "Invalid voice_name")
    if not os.path.exists(ref_audio_path) or not os.path.exists(ref_transcript_path):
        raise HTTPException(404, f"Voice profile '{voice_name}' not found")

    with open(ref_transcript_path, encoding="utf-8") as f:
        ref_transcript = f.read()

    if asr_model not in config.ASR_MODEL_CHOICES:
        raise HTTPException(422, f"Invalid asr_model. Choose from {config.ASR_MODEL_CHOICES}")

    async def stream() -> AsyncGenerator[str, None]:
        source_wav_path: str | None = None
        progress_queue: asyncio.Queue = asyncio.Queue()

        async def _progress_cb(value: float, desc: str) -> None:
            await progress_queue.put(("progress", value, desc))

        async def run_nlm() -> None:
            try:
                audio_bytes = await generate_podcast_audio(
                    sources=sources_list,
                    instructions=instructions,
                    audio_format=audio_format,
                    language=language,
                    auto_delete=auto_delete,
                    progress_cb=_progress_cb,
                )
                await progress_queue.put(("audio", audio_bytes))
            except Exception as e:
                await progress_queue.put(("error", e))

        nlm_task = asyncio.create_task(run_nlm())

        try:
            audio_bytes: bytes | None = None
            while True:
                item = await progress_queue.get()
                if item[0] == "progress":
                    yield _progress(item[1], item[2])
                elif item[0] == "audio":
                    audio_bytes = item[1]
                    break
                elif item[0] == "error":
                    yield _error(item[1])
                    yield _done()
                    return

            if not audio_bytes:
                yield _error(RuntimeError("No audio received from NotebookLM"))
                yield _done()
                return

            yield _progress(0.52, "Normalizing podcast audio...")
            source_wav_path = await asyncio.to_thread(
                uploaded_bytes_to_wav, audio_bytes, "podcast.mp4"
            )

            yield _progress(0.58, f"Transcribing with faster-whisper ({asr_model})...")
            asr_data = await model_manager.with_asr(
                asr_model,
                transcribe_sync,
                source_wav_path,
                "Auto",
            )
            transcript = asr_data["transcript"]

            chunk_count = estimate_chunk_count(transcript)
            yield _progress(
                0.72,
                f"Synthesizing with voice '{safe_voice_name}'..."
                if chunk_count <= 1
                else f"Synthesizing with voice '{safe_voice_name}' in {chunk_count} chunks...",
            )
            tts_data = await model_manager.with_tts(
                synthesize_sync,
                ref_audio_path,
                ref_transcript,
                transcript,
                speed,
                pitch,
                emotion,
            )

            yield _progress(0.95, "Encoding output...")

            history_meta = None
            if save_history:
                history_meta = history_svc.save_generation(
                    tts_data["audio_np"],
                    tts_data["sample_rate"],
                    kind="convert",
                    voice_name=safe_voice_name,
                    text=transcript,
                    source_filename="notebooklm_podcast",
                    emotion=emotion,
                    speed=speed,
                    pitch=pitch,
                    duration=tts_data["duration"],
                )

            yield _result(
                audio_b64=tts_data["audio_b64"],
                sample_rate=tts_data["sample_rate"],
                duration=tts_data["duration"],
                transcript=transcript,
                chunk_count=tts_data.get("chunk_count", 1),
                history_id=(history_meta or {}).get("id"),
            )
            yield _done()

        except Exception as e:
            yield _error(e)
            yield _done()
        finally:
            cleanup_temp_file(source_wav_path)
            nlm_task.cancel()

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
