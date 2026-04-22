import re


def normalize_transcript_text(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.split())


def format_transcript_text(text: str) -> str:
    normalized = normalize_transcript_text(text)
    if not normalized:
        return ""
    return re.sub(r'(?<=[.!?])\s+', "\n", normalized).strip()


def build_transcript_from_segments(segments) -> str:
    parts = []
    for segment in segments:
        if isinstance(segment, dict):
            segment_text = (segment.get("text") or "").strip()
        else:
            segment_text = (getattr(segment, "text", "") or "").strip()
        if segment_text:
            parts.append(segment_text)
    return format_transcript_text(" ".join(parts))
