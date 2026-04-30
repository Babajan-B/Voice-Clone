import os
import json
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse

import config
from services import model_manager, history as history_svc
from services.asr_service import transcribe_sync
from services.tts_service import estimate_chunk_count, synthesize_sync
from utils.audio import uploaded_bytes_to_wav, cleanup_temp_file
from utils.errors import VoiceCloneError
from utils.subtitles import segments_to_srt, segments_to_vtt
from utils.voices import voice_profile_paths

router = APIRouter()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def progress(value: float, desc: str) -> str:
    return sse_event({"type": "progress", "value": value, "desc": desc})


def result(**payload) -> str:
    return sse_event({"type": "result", **payload})


def error(exc: Exception) -> str:
    if isinstance(exc, VoiceCloneError):
        return sse_event({"type": "error", **exc.to_payload()})
    return sse_event({"type": "error", "code": "UNKNOWN", "message": str(exc), "hint": ""})


def done() -> str:
    return sse_event({"type": "done"})


# ─────────────────── /api/transcribe ───────────────────

@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("Auto"),
):
    if model_size not in config.ASR_MODEL_CHOICES:
        raise HTTPException(422, f"Invalid model_size. Choose from {config.ASR_MODEL_CHOICES}")
    if language not in config.ASR_LANGUAGE_CHOICES:
        raise HTTPException(422, f"Invalid language. Choose from {config.ASR_LANGUAGE_CHOICES}")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(422, "Empty audio upload")
    original_name = audio.filename or ""

    async def stream() -> AsyncGenerator[str, None]:
        wav_path: str | None = None
        try:
            yield progress(0.05, "Normalizing audio...")
            wav_path = await asyncio.to_thread(uploaded_bytes_to_wav, audio_bytes, original_name)

            yield progress(0.15, f"Loading faster-whisper ({model_size})...")
            yield progress(0.35, "Transcribing media...")

            data = await model_manager.with_asr(
                model_size,
                transcribe_sync,
                wav_path,
                language,
            )

            yield progress(0.9, "Cleaning transcript...")
            yield result(
                transcript=data["transcript"],
                language=data["language"],
                language_probability=data["language_probability"],
                segment_count=data["segment_count"],
                segments=data["segments"],
                compute_type=data["compute_type"],
            )
            yield done()
        except Exception as e:
            yield error(e)
        finally:
            cleanup_temp_file(wav_path)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


# Helper endpoint: convert a posted segment list to SRT or VTT. Keeps the
# frontend simple — just POST the transcript result and get a file back.

@router.post("/transcribe/subtitle")
async def transcribe_subtitle(fmt: str, segments: list[dict] | None = None):  # noqa: B008
    raise HTTPException(400, "Use POST /api/subtitles with JSON body {format, segments}.")


@router.post("/subtitles")
async def subtitles(payload: dict):
    fmt = (payload.get("format") or "srt").lower()
    segs = payload.get("segments") or []
    if fmt == "srt":
        return PlainTextResponse(segments_to_srt(segs), media_type="application/x-subrip")
    if fmt == "vtt":
        return PlainTextResponse(segments_to_vtt(segs), media_type="text/vtt")
    raise HTTPException(400, "format must be 'srt' or 'vtt'")


# ─────────────────── /api/generate ───────────────────

@router.post("/generate")
async def generate(
    ref_audio: UploadFile = File(...),
    ref_transcript: str = Form(...),
    target_text: str = Form(...),
    speed: float = Form(1.0),
    pitch: float = Form(0.0),
    emotion: str = Form("neutral"),
    save_history: bool = Form(True),
    voice_name: str = Form(""),
):
    if not ref_transcript.strip():
        raise HTTPException(422, "ref_transcript is required")
    if not target_text.strip():
        raise HTTPException(422, "target_text is required")

    audio_bytes = await ref_audio.read()
    if not audio_bytes:
        raise HTTPException(422, "Empty reference audio")
    original_name = ref_audio.filename or ""

    async def stream() -> AsyncGenerator[str, None]:
        wav_path: str | None = None
        try:
            yield progress(0.05, "Normalizing reference audio...")
            wav_path = await asyncio.to_thread(uploaded_bytes_to_wav, audio_bytes, original_name)

            chunk_count = estimate_chunk_count(target_text.strip())
            yield progress(0.15, "Loading Qwen TTS model...")
            yield progress(
                0.35,
                "Synthesizing cloned voice..."
                if chunk_count <= 1
                else f"Synthesizing cloned voice in {chunk_count} chunks...",
            )

            data = await model_manager.with_tts(
                synthesize_sync,
                wav_path,
                ref_transcript.strip(),
                target_text.strip(),
                speed,
                pitch,
                emotion,
            )

            yield progress(0.95, "Encoding output...")

            history_meta = None
            if save_history:
                history_meta = history_svc.save_generation(
                    data["audio_np"],
                    data["sample_rate"],
                    kind="synthesize",
                    voice_name=voice_name or None,
                    text=target_text.strip(),
                    emotion=emotion,
                    speed=speed,
                    pitch=pitch,
                    duration=data["duration"],
                )

            yield result(
                audio_b64=data["audio_b64"],
                sample_rate=data["sample_rate"],
                duration=data["duration"],
                chunk_count=data.get("chunk_count", 1),
                history_id=(history_meta or {}).get("id"),
            )
            yield done()
        except Exception as e:
            yield error(e)
        finally:
            cleanup_temp_file(wav_path)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


# ─────────────────── /api/convert ───────────────────

@router.post("/convert")
async def convert(
    source_audio: UploadFile = File(...),
    voice_name: str = Form(...),
    model_size: str = Form("base"),
    language: str = Form("Auto"),
    speed: float = Form(1.0),
    pitch: float = Form(0.0),
    emotion: str = Form("neutral"),
    transcribe_only: bool = Form(False),
    save_history: bool = Form(True),
):
    if model_size not in config.ASR_MODEL_CHOICES:
        raise HTTPException(422, "Invalid model_size")
    if language not in config.ASR_LANGUAGE_CHOICES:
        raise HTTPException(422, "Invalid language")
    if not voice_name.strip() and not transcribe_only:
        raise HTTPException(422, "voice_name is required")

    safe_voice_name = voice_name.strip()
    ref_audio_path = ""
    ref_transcript_path = ""
    ref_transcript = ""
    if not transcribe_only:
        try:
            safe_voice_name, ref_audio_path, ref_transcript_path = voice_profile_paths(voice_name)
        except ValueError:
            raise HTTPException(422, "Invalid voice_name")
        if not os.path.exists(ref_audio_path) or not os.path.exists(ref_transcript_path):
            raise HTTPException(404, f"Voice profile '{voice_name}' not found")
        with open(ref_transcript_path, "r", encoding="utf-8") as f:
            ref_transcript = f.read()

    audio_bytes = await source_audio.read()
    if not audio_bytes:
        raise HTTPException(422, "Empty source audio")
    original_name = source_audio.filename or ""

    async def stream() -> AsyncGenerator[str, None]:
        source_wav_path: str | None = None
        try:
            yield progress(0.02, "Normalizing source audio...")
            source_wav_path = await asyncio.to_thread(uploaded_bytes_to_wav, audio_bytes, original_name)

            yield progress(0.1, f"Transcribing source with {model_size}...")
            asr_data = await model_manager.with_asr(
                model_size,
                transcribe_sync,
                source_wav_path,
                language,
            )
            transcript = asr_data["transcript"]

            if transcribe_only:
                # Review step: return transcript only, no TTS.
                yield progress(0.95, "Transcript ready for review")
                yield result(
                    transcript=transcript,
                    language=asr_data["language"],
                    segments=asr_data["segments"],
                    transcribe_only=True,
                )
                yield done()
                return

            yield progress(0.5, "Loading TTS model...")
            chunk_count = estimate_chunk_count(transcript)
            yield progress(
                0.6,
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

            yield progress(0.95, "Encoding output...")

            history_meta = None
            if save_history:
                history_meta = history_svc.save_generation(
                    tts_data["audio_np"],
                    tts_data["sample_rate"],
                    kind="convert",
                    voice_name=safe_voice_name,
                    text=transcript,
                    source_filename=original_name,
                    emotion=emotion,
                    speed=speed,
                    pitch=pitch,
                    duration=tts_data["duration"],
                )

            yield result(
                audio_b64=tts_data["audio_b64"],
                sample_rate=tts_data["sample_rate"],
                duration=tts_data["duration"],
                transcript=transcript,
                language=asr_data["language"],
                chunk_count=tts_data.get("chunk_count", 1),
                history_id=(history_meta or {}).get("id"),
            )
            yield done()
        except Exception as e:
            yield error(e)
        finally:
            cleanup_temp_file(source_wav_path)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


# Synthesize on a reviewed/edited transcript using a saved voice profile.
# Used as the "second half" of a review-first voice-to-voice conversion.

@router.post("/convert/finalize")
async def convert_finalize(
    voice_name: str = Form(...),
    transcript: str = Form(...),
    speed: float = Form(1.0),
    pitch: float = Form(0.0),
    emotion: str = Form("neutral"),
    save_history: bool = Form(True),
):
    if not transcript.strip():
        raise HTTPException(422, "transcript is required")
    try:
        safe_voice_name, ref_audio_path, ref_transcript_path = voice_profile_paths(voice_name)
    except ValueError:
        raise HTTPException(422, "Invalid voice_name")
    if not os.path.exists(ref_audio_path) or not os.path.exists(ref_transcript_path):
        raise HTTPException(404, f"Voice profile '{voice_name}' not found")
    with open(ref_transcript_path, "r", encoding="utf-8") as f:
        ref_transcript = f.read()

    async def stream() -> AsyncGenerator[str, None]:
        try:
            yield progress(0.2, "Loading TTS model...")
            chunk_count = estimate_chunk_count(transcript.strip())
            yield progress(
                0.4,
                f"Synthesizing with voice '{safe_voice_name}'..."
                if chunk_count <= 1
                else f"Synthesizing with voice '{safe_voice_name}' in {chunk_count} chunks...",
            )
            tts_data = await model_manager.with_tts(
                synthesize_sync,
                ref_audio_path,
                ref_transcript,
                transcript.strip(),
                speed,
                pitch,
                emotion,
            )
            yield progress(0.95, "Encoding output...")

            history_meta = None
            if save_history:
                history_meta = history_svc.save_generation(
                    tts_data["audio_np"],
                    tts_data["sample_rate"],
                    kind="convert",
                    voice_name=safe_voice_name,
                    text=transcript.strip(),
                    emotion=emotion,
                    speed=speed,
                    pitch=pitch,
                    duration=tts_data["duration"],
                )

            yield result(
                audio_b64=tts_data["audio_b64"],
                sample_rate=tts_data["sample_rate"],
                duration=tts_data["duration"],
                transcript=transcript.strip(),
                chunk_count=tts_data.get("chunk_count", 1),
                history_id=(history_meta or {}).get("id"),
            )
            yield done()
        except Exception as e:
            yield error(e)

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)


# ─────────────────── /api/unload ───────────────────

@router.post("/unload")
async def unload_models():
    await model_manager.unload_all()
    return {"status": "unloaded"}
