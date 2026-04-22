from utils.text import build_transcript_from_segments
from utils.errors import NoSpeechError


def transcribe_sync(asr_model, compute_type: str, wav_path: str, language: str):
    """Synchronous faster-whisper transcription with word-level timestamps."""
    segments_iter, info = asr_model.transcribe(
        wav_path,
        beam_size=5,
        language=None if language == "Auto" else language,
        vad_filter=True,
        condition_on_previous_text=False,
        word_timestamps=True,
    )

    segments = []
    for seg in segments_iter:
        words = []
        for w in getattr(seg, "words", None) or []:
            words.append({
                "start": float(getattr(w, "start", 0.0) or 0.0),
                "end": float(getattr(w, "end", 0.0) or 0.0),
                "word": (getattr(w, "word", "") or "").strip(),
                "probability": float(getattr(w, "probability", 0.0) or 0.0),
            })
        segments.append({
            "id": int(getattr(seg, "id", 0) or 0),
            "start": float(seg.start or 0.0),
            "end": float(seg.end or 0.0),
            "text": (seg.text or "").strip(),
            "words": words,
        })

    transcript = build_transcript_from_segments(segments)

    if not transcript:
        raise NoSpeechError("No speech was detected in the selected media.")

    return {
        "transcript": transcript,
        "language": info.language or "unknown",
        "language_probability": float(getattr(info, "language_probability", 0.0) or 0.0),
        "segment_count": len(segments),
        "segments": segments,
        "compute_type": compute_type,
    }
