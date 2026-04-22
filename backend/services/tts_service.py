import re
import numpy as np
import librosa

import config
from utils.audio import numpy_to_wav_base64


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

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z\u00C0-\u024F\u4E00-\u9FFF\u0600-\u06FF])")


def _split_into_chunks(text: str, limit: int) -> list[str]:
    """Split text into <=limit-char chunks on sentence boundaries.

    Falls back to comma/whitespace splits if a single sentence exceeds the limit.
    """
    text = text.strip()
    if not text or len(text) <= limit:
        return [text] if text else []

    sentences = _SENTENCE_SPLIT_RE.split(text)
    chunks: list[str] = []
    buf = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(s) > limit:
            # Split long sentence on commas, then whitespace.
            pieces = [p.strip() for p in re.split(r",\s+", s) if p.strip()]
            for p in pieces:
                if len(p) > limit:
                    # Hard split every `limit` chars at a space boundary.
                    words = p.split()
                    cur = ""
                    for w in words:
                        if len(cur) + len(w) + 1 > limit and cur:
                            chunks.append(cur.strip())
                            cur = w
                        else:
                            cur = (cur + " " + w).strip()
                    if cur:
                        chunks.append(cur)
                else:
                    if len(buf) + len(p) + 2 > limit and buf:
                        chunks.append(buf.strip())
                        buf = p
                    else:
                        buf = (buf + ", " + p).strip(", ")
            continue
        if len(buf) + len(s) + 1 > limit and buf:
            chunks.append(buf.strip())
            buf = s
        else:
            buf = (buf + " " + s).strip()
    if buf:
        chunks.append(buf.strip())
    return chunks


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
    prefix = EMOTION_PREFIXES.get((emotion or "neutral").lower(), "")
    chunks = _split_into_chunks(target_text, config.TTS_CHUNK_CHAR_LIMIT)

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
        clips.append(np.asarray(wavs[0], dtype=np.float32))
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
