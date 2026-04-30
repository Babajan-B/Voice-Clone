import os

import config


def sanitize_voice_name(name: str) -> str:
    """Return the filesystem-safe voice profile name used on disk."""
    return "".join(c for c in name if c.isalnum() or c in (" ", "-", "_")).strip()


def validate_voice_name(name: str) -> str:
    safe_name = sanitize_voice_name(name or "")
    if not safe_name or safe_name != (name or "").strip():
        raise ValueError("Invalid voice name")
    return safe_name


def voice_profile_paths(name: str) -> tuple[str, str, str]:
    safe_name = validate_voice_name(name)
    return (
        safe_name,
        os.path.join(config.SAVED_VOICES_DIR, f"{safe_name}.wav"),
        os.path.join(config.SAVED_VOICES_DIR, f"{safe_name}.txt"),
    )
