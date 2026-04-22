import os
import io
import base64
import tempfile
import soundfile as sf
import librosa
import numpy as np


def uploaded_bytes_to_wav(upload_bytes: bytes, original_filename: str = "") -> str:
    """Write arbitrary audio bytes to a temp WAV using librosa for format normalization.

    Handles WebM (browser recordings), MP3, MP4, etc. Always outputs 16-bit PCM mono WAV.
    """
    suffix = os.path.splitext(original_filename)[1] or ".tmp"
    fd, raw_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with open(raw_path, "wb") as f:
            f.write(upload_bytes)
        audio_np, sr = librosa.load(raw_path, sr=None, mono=True)
    finally:
        if os.path.exists(raw_path):
            os.unlink(raw_path)

    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    sf.write(wav_path, audio_np, sr)
    return wav_path


def numpy_to_wav_base64(audio_np: np.ndarray, sample_rate: int) -> str:
    """Encode a numpy audio array as a base64-encoded WAV for JSON transport."""
    buf = io.BytesIO()
    sf.write(buf, audio_np, sample_rate, format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def cleanup_temp_file(path: str | None) -> None:
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except OSError:
            pass
