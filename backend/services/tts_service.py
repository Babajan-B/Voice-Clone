import math
import re
import numpy as np
import librosa

import config
from utils.audio import numpy_to_wav_base64
from utils.errors import VoiceCloneError


EMOTION_PREFIXES = {
    "neutral": "",
    "happy": "Say this in a happy, upbeat tone: ",
    "sad": "Say this in a sad, somber tone: ",
    "angry": "Say this in an angry, intense tone: ",
    "excited": "Say this in an excited, enthusiastic tone: ",
    "calm": "Say this in a calm, relaxed tone: ",
    "serious": "Say this in a serious, formal tone: ",
    "whisper": "Whisper this softly: ",
}

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?\u061f\u06d4\u3002\uff01\uff1f])\s+")
_SOFT_SPLIT_RE = re.compile(r"([,;:\u060c\u061b،؛]\s+|\s+)")


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _split_long_piece(piece: str, limit: int) -> list[str]:
    """Split an over-limit sentence while preserving words where possible."""
    parts: list[str] = []
    buf = ""

    for token in _SOFT_SPLIT_RE.split(piece):
        if not token:
            continue
        candidate = f"{buf}{token}" if buf else token.lstrip()
        if len(candidate) <= limit:
            buf = candidate
            continue

        if buf.strip():
            parts.append(buf.strip())
            buf = token.lstrip()
        elif not buf:
            buf = token.lstrip()

        while len(buf) > limit:
            split_at = buf.rfind(" ", 0, limit + 1)
            if split_at < max(1, int(limit * 0.6)):
                split_at = limit
            parts.append(buf[:split_at].strip())
            buf = buf[split_at:].strip()

    if buf.strip():
        parts.append(buf.strip())

    return parts


def _split_into_chunks(text: str, limit: int) -> list[str]:
    """Split text into <=limit-char chunks on sentence boundaries.

    Falls back to comma/whitespace splits if a single sentence exceeds the limit.
    """
    if limit < 80:
        raise ValueError("TTS_CHUNK_CHAR_LIMIT must be at least 80")

    text = _normalize_text(text)
    if not text or len(text) <= limit:
        return [text] if text else []

    sentences = _SENTENCE_SPLIT_RE.split(text)
    chunks: list[str] = []
    buf = ""

    for s in sentences:
        s = s.strip()
        if not s:
            continue

        pieces = _split_long_piece(s, limit) if len(s) > limit else [s]
        for piece in pieces:
            separator = "" if not buf else " "
            if len(buf) + len(separator) + len(piece) > limit and buf:
                chunks.append(buf.strip())
                buf = piece
            else:
                buf = f"{buf}{separator}{piece}".strip()

    if buf:
        chunks.append(buf.strip())

    return chunks


def estimate_chunk_count(text: str) -> int:
    return len(_split_into_chunks(text, config.TTS_CHUNK_CHAR_LIMIT))


def _validate_audio_clip(clip: np.ndarray, idx: int) -> np.ndarray:
    clip = np.asarray(clip, dtype=np.float32).reshape(-1)
    if clip.size == 0:
        raise VoiceCloneError(
            f"TTS returned empty audio for chunk {idx}.",
            code="TTS_EMPTY_CHUNK",
            hint="Try shortening the text near that chunk or lowering TTS_CHUNK_CHAR_LIMIT.",
        )
    if not np.all(np.isfinite(clip)):
        raise VoiceCloneError(
            f"TTS returned invalid audio values for chunk {idx}.",
            code="TTS_INVALID_AUDIO",
            hint="Try regenerating, or reduce pitch/speed changes for long text.",
        )
    return clip


def _crossfade_concat(clips: list[np.ndarray], sample_rate: int, fade_ms: int = 30) -> np.ndarray:
    if not clips:
        return np.zeros(0, dtype=np.float32)
    if len(clips) == 1:
        return clips[0].astype(np.float32)
    fade_samples = max(1, int(sample_rate * fade_ms / 1000))
    out = clips[0].astype(np.float32).copy()
    for clip in clips[1:]:
        clip = clip.astype(np.float32)
        n = min(fade_samples, len(out), len(clip))
        if n <= 0:
            out = np.concatenate([out, clip])
            continue
        fade_out = np.linspace(1.0, 0.0, n, dtype=np.float32)
        fade_in = np.linspace(0.0, 1.0, n, dtype=np.float32)
        out[-n:] = out[-n:] * fade_out + clip[:n] * fade_in
        out = np.concatenate([out, clip[n:]])
    return out


def _apply_prosody(audio_np: np.ndarray, sample_rate: int, speed: float, pitch_semitones: float) -> np.ndarray:
    out = audio_np.astype(np.float32)
    if abs(pitch_semitones) > 1e-3:
        out = librosa.effects.pitch_shift(out, sr=sample_rate, n_steps=float(pitch_semitones))
    if abs(speed - 1.0) > 1e-3:
        out = librosa.effects.time_stretch(out, rate=float(speed))
    return out


def _clamp_controls(speed: float, pitch_semitones: float) -> tuple[float, float]:
    speed = float(speed)
    pitch_semitones = float(pitch_semitones)
    if not math.isfinite(speed):
        speed = 1.0
    if not math.isfinite(pitch_semitones):
        pitch_semitones = 0.0
    return min(max(speed, 0.5), 1.75), min(max(pitch_semitones, -12.0), 12.0)


def synthesize_sync(
    tts_model,
    ref_audio_path: str,
    ref_transcript: str,
    target_text: str,
    speed: float = 1.0,
    pitch_semitones: float = 0.0,
    emotion: str = "neutral",
    progress_cb=None,
):
    """Synchronous voice cloning synthesis. Runs in thread pool.

    If `target_text` is longer than config.TTS_CHUNK_CHAR_LIMIT, it is split
    on sentence boundaries, each chunk synthesized separately, and the
    resulting audio concatenated with a short crossfade.
    """
    speed, pitch_semitones = _clamp_controls(speed, pitch_semitones)
    prefix = EMOTION_PREFIXES.get((emotion or "neutral").lower(), "")
    effective_limit = max(80, config.TTS_CHUNK_CHAR_LIMIT - len(prefix))
    chunks = _split_into_chunks(target_text, effective_limit)

    if not chunks:
        raise ValueError("target_text is empty after chunking")

    clips: list[np.ndarray] = []
    sample_rate = 16000
    for idx, chunk in enumerate(chunks):
        prompted = f"{prefix}{chunk}" if prefix else chunk
        wavs, sr = tts_model.generate_voice_clone(
            text=prompted,
            language="Auto",
            ref_audio=ref_audio_path,
            ref_text=ref_transcript,
        )
        sample_rate = int(sr)
        clips.append(_validate_audio_clip(wavs[0], idx + 1))
        if progress_cb is not None:
            try:
                progress_cb(idx + 1, len(chunks))
            except Exception:
                pass

    audio_np = _crossfade_concat(clips, sample_rate)
    audio_np = _apply_prosody(audio_np, sample_rate, speed, pitch_semitones)

    duration = float(len(audio_np)) / float(sample_rate)
    return {
        "audio_b64": numpy_to_wav_base64(audio_np, sample_rate),
        "audio_np": audio_np,
        "sample_rate": sample_rate,
        "duration": duration,
        "chunk_count": len(chunks),
    }
