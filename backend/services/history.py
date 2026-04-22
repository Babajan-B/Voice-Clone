"""Generation history: persist generated/converted audio + metadata to disk.

Files land in config.GENERATED_DIR as:
  <timestamp>_<kind>.wav
  <timestamp>_<kind>.json
"""
import os
import json
import time
import re
import soundfile as sf
import numpy as np

import config


def _safe_slug(s: str, max_len: int = 40) -> str:
    s = re.sub(r"[^A-Za-z0-9_\-]+", "-", s).strip("-")
    return s[:max_len] or "untitled"


def save_generation(
    audio_np: np.ndarray,
    sample_rate: int,
    *,
    kind: str,              # "synthesize" or "convert"
    voice_name: str | None,
    text: str,
    source_filename: str | None = None,
    emotion: str = "neutral",
    speed: float = 1.0,
    pitch: float = 0.0,
    duration: float | None = None,
    extra: dict | None = None,
) -> dict:
    """Write a wav + sidecar json. Returns the metadata dict that was written."""
    ts = time.strftime("%Y%m%d-%H%M%S")
    slug_parts = [kind, _safe_slug(voice_name or "unknown")]
    base = f"{ts}_{'_'.join(slug_parts)}"

    wav_path = os.path.join(config.GENERATED_DIR, f"{base}.wav")
    json_path = os.path.join(config.GENERATED_DIR, f"{base}.json")

    sf.write(wav_path, audio_np, sample_rate)

    meta = {
        "id": base,
        "kind": kind,
        "created_at": time.time(),
        "created_at_iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "voice_name": voice_name,
        "text": text[:2000],
        "source_filename": source_filename,
        "emotion": emotion,
        "speed": speed,
        "pitch": pitch,
        "duration": duration,
        "sample_rate": sample_rate,
        "audio_url": f"/generated-static/{base}.wav",
    }
    if extra:
        meta.update(extra)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return meta


def list_history(limit: int = 100) -> list[dict]:
    if not os.path.isdir(config.GENERATED_DIR):
        return []
    items: list[dict] = []
    for fname in os.listdir(config.GENERATED_DIR):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(config.GENERATED_DIR, fname), "r", encoding="utf-8") as f:
                items.append(json.load(f))
        except Exception:
            continue
    items.sort(key=lambda m: m.get("created_at", 0), reverse=True)
    return items[:limit]


def delete_entry(entry_id: str) -> bool:
    wav = os.path.join(config.GENERATED_DIR, f"{entry_id}.wav")
    meta = os.path.join(config.GENERATED_DIR, f"{entry_id}.json")
    deleted = False
    for p in (wav, meta):
        if os.path.exists(p):
            try:
                os.remove(p)
                deleted = True
            except OSError:
                pass
    return deleted


def clear_all() -> int:
    if not os.path.isdir(config.GENERATED_DIR):
        return 0
    count = 0
    for fname in os.listdir(config.GENERATED_DIR):
        try:
            os.remove(os.path.join(config.GENERATED_DIR, fname))
            count += 1
        except OSError:
            pass
    return count
