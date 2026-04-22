import os
import torch

# Paths
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
SAVED_VOICES_DIR = os.path.join(PROJECT_ROOT, "saved_voices")
GENERATED_DIR = os.path.join(PROJECT_ROOT, "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)

# Long-text chunking: target characters per TTS call. Longer texts are split
# on sentence boundaries and concatenated with a short crossfade.
TTS_CHUNK_CHAR_LIMIT = int(os.getenv("TTS_CHUNK_CHAR_LIMIT", "280"))

# Models
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"

# ASR choices
ASR_MODEL_CHOICES = ["tiny", "base", "small", "medium", "large-v3", "turbo"]
ASR_LANGUAGE_CHOICES = ["Auto", "en", "ar", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]

# Device detection
if torch.cuda.is_available():
    DEVICE = "cuda:0"
    TTS_DTYPE = torch.bfloat16
    ATTENTION_IMPL = "flash_attention_2"
elif torch.backends.mps.is_available():
    DEVICE = "mps"
    TTS_DTYPE = torch.bfloat16
    ATTENTION_IMPL = "eager"
else:
    DEVICE = "cpu"
    TTS_DTYPE = torch.float32
    ATTENTION_IMPL = "eager"

ASR_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Create saved_voices directory if it doesn't exist
os.makedirs(SAVED_VOICES_DIR, exist_ok=True)
