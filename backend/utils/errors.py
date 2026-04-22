"""Structured errors that carry an actionable code + user-facing message.

Raised from services so routers can surface consistent SSE error events:
  data: {"type":"error","code":"NO_SPEECH_DETECTED","message":"...","hint":"..."}
"""


class VoiceCloneError(Exception):
    code: str = "UNKNOWN"
    hint: str = ""

    def __init__(self, message: str, *, code: str | None = None, hint: str | None = None):
        super().__init__(message)
        if code:
            self.code = code
        if hint:
            self.hint = hint

    def to_payload(self) -> dict:
        return {"code": self.code, "message": str(self), "hint": self.hint}


class NoSpeechError(VoiceCloneError):
    code = "NO_SPEECH_DETECTED"
    hint = "We couldn't detect any speech in that file. Check volume and try another clip."


class UnsupportedFormatError(VoiceCloneError):
    code = "UNSUPPORTED_FORMAT"
    hint = "Couldn't decode this file. Install ffmpeg (brew install ffmpeg) or convert to WAV/MP3."


class ModelLoadError(VoiceCloneError):
    code = "MODEL_LOAD_FAILED"
    hint = "The model failed to load. Free some memory and try again, or POST /api/unload."
