"""SRT and WebVTT subtitle generation from faster-whisper segments."""
from typing import Iterable


def _fmt_time_srt(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _fmt_time_vtt(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def segments_to_srt(segments: Iterable[dict]) -> str:
    out = []
    for i, seg in enumerate(segments, 1):
        start = _fmt_time_srt(float(seg["start"]))
        end = _fmt_time_srt(float(seg["end"]))
        text = (seg.get("text") or "").strip()
        out.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(out)


def segments_to_vtt(segments: Iterable[dict]) -> str:
    parts = ["WEBVTT\n"]
    for seg in segments:
        start = _fmt_time_vtt(float(seg["start"]))
        end = _fmt_time_vtt(float(seg["end"]))
        text = (seg.get("text") or "").strip()
        parts.append(f"{start} --> {end}\n{text}\n")
    return "\n".join(parts)
