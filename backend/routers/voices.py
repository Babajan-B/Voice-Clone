from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
import os
import shutil
import config
from utils.audio import uploaded_bytes_to_wav, cleanup_temp_file
from utils.voices import sanitize_voice_name, voice_profile_paths

router = APIRouter()


class VoiceResponse(BaseModel):
    voices: list[str]


class VoiceDetail(BaseModel):
    name: str
    transcript: str
    audio_url: str


def get_saved_voices():
    """Get list of saved voice profile names."""
    voices = []
    if os.path.exists(config.SAVED_VOICES_DIR):
        for f in os.listdir(config.SAVED_VOICES_DIR):
            if f.endswith(".wav"):
                name = f[:-4]
                transcript_path = os.path.join(config.SAVED_VOICES_DIR, f"{name}.txt")
                if os.path.exists(transcript_path):
                    voices.append(name)
    return sorted(voices)


@router.get("/voices")
async def list_voices() -> VoiceResponse:
    """Get list of all saved voice profiles."""
    return VoiceResponse(voices=get_saved_voices())


@router.get("/voices/{name}")
async def get_voice(name: str) -> VoiceDetail:
    """Get a specific voice profile details."""
    try:
        safe_name, audio_path, transcript_path = voice_profile_paths(name)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voice name")

    if not os.path.exists(audio_path) or not os.path.exists(transcript_path):
        raise HTTPException(status_code=404, detail=f"Voice '{name}' not found")

    with open(transcript_path, "r", encoding="utf-8") as f:
        transcript = f.read()

    return VoiceDetail(
        name=safe_name,
        transcript=transcript,
        audio_url=f"/voices-static/{safe_name}.wav"
    )


@router.post("/voices")
async def save_voice(
    audio: UploadFile = File(...),
    transcript: str = Form(...),
    name: str = Form(...)
) -> VoiceResponse:
    """Save a new voice profile."""
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=422, detail="Transcript is required")
    if not name or not name.strip():
        raise HTTPException(status_code=422, detail="Voice name is required")

    safe_name = sanitize_voice_name(name)
    if not safe_name:
        raise HTTPException(status_code=422, detail="Invalid voice name after sanitization")

    # Read audio file
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="No audio data provided")

    # Normalize via librosa to handle WebM/Ogg/MP3/etc. from browser
    audio_path = os.path.join(config.SAVED_VOICES_DIR, f"{safe_name}.wav")
    tmp_wav = uploaded_bytes_to_wav(audio_bytes, audio.filename or "")
    try:
        shutil.move(tmp_wav, audio_path)
    finally:
        cleanup_temp_file(tmp_wav)

    # Save transcript
    transcript_path = os.path.join(config.SAVED_VOICES_DIR, f"{safe_name}.txt")
    with open(transcript_path, "w", encoding="utf-8") as f:
        f.write(transcript.strip())

    return VoiceResponse(voices=get_saved_voices())


@router.delete("/voices/{name}")
async def delete_voice(name: str) -> VoiceResponse:
    """Delete a voice profile."""
    try:
        _, audio_path, transcript_path = voice_profile_paths(name)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid voice name")

    deleted = False
    if os.path.exists(audio_path):
        os.remove(audio_path)
        deleted = True
    if os.path.exists(transcript_path):
        os.remove(transcript_path)
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Voice '{name}' not found")

    return VoiceResponse(voices=get_saved_voices())
