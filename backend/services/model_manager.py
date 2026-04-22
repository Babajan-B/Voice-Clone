"""Async-safe model manager with mutual exclusion.

Ports the mutex logic from app.py: only one heavy model (TTS or ASR) stays
loaded at a time to avoid memory exhaustion. All model state is guarded by
an asyncio.Lock so concurrent FastAPI requests cannot race to load/unload.
"""
import asyncio
import gc
import torch

import config

_tts_model = None
_asr_model = None
_asr_config: tuple | None = None  # (model_size, device, compute_type)
_lock = asyncio.Lock()


def _release_torch_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        try:
            torch.mps.empty_cache()
        except Exception:
            pass


def _unload_tts_sync():
    global _tts_model
    if _tts_model is not None:
        _tts_model = None
        _release_torch_memory()
        print("Released Qwen TTS model from memory.")


def _unload_asr_sync():
    global _asr_model, _asr_config
    if _asr_model is not None:
        _asr_model = None
        _asr_config = None
        _release_torch_memory()
        print("Released faster-whisper model from memory.")


def _load_tts_sync():
    global _tts_model
    if _tts_model is not None:
        return _tts_model

    _unload_asr_sync()

    from qwen_tts import Qwen3TTSModel
    _tts_model = Qwen3TTSModel.from_pretrained(
        config.MODEL_ID,
        device_map=config.DEVICE,
        dtype=config.TTS_DTYPE,
        attn_implementation=config.ATTENTION_IMPL,
    )
    print(f"Loaded '{config.MODEL_ID}' on {config.DEVICE}")
    return _tts_model


def _asr_compute_type_candidates():
    if config.ASR_DEVICE == "cuda":
        return ["float16", "int8_float16"]
    return ["int8", "float32"]


def _load_asr_sync(model_size: str):
    global _asr_model, _asr_config

    if (
        _asr_model is not None
        and _asr_config is not None
        and _asr_config[0] == model_size
    ):
        return _asr_model, _asr_config[2]

    _unload_tts_sync()

    from faster_whisper import WhisperModel
    errors = []
    for compute_type in _asr_compute_type_candidates():
        try:
            model = WhisperModel(model_size, device=config.ASR_DEVICE, compute_type=compute_type)
            _asr_model = model
            _asr_config = (model_size, config.ASR_DEVICE, compute_type)
            print(f"Loaded faster-whisper '{model_size}' on {config.ASR_DEVICE} with {compute_type}")
            return model, compute_type
        except Exception as e:
            errors.append(f"{compute_type}: {e}")

    raise RuntimeError("Could not load faster-whisper model. " + " | ".join(errors))


async def with_tts(fn, *args, **kwargs):
    """Run fn(tts_model, *args) inside the model lock. Unloads ASR first."""
    async with _lock:
        tts = await asyncio.to_thread(_load_tts_sync)
        return await asyncio.to_thread(fn, tts, *args, **kwargs)


async def with_asr(model_size: str, fn, *args, **kwargs):
    """Run fn(asr_model, compute_type, *args) inside the lock. Unloads TTS first."""
    async with _lock:
        asr, compute_type = await asyncio.to_thread(_load_asr_sync, model_size)
        return await asyncio.to_thread(fn, asr, compute_type, *args, **kwargs)


async def unload_all():
    async with _lock:
        await asyncio.to_thread(_unload_tts_sync)
        await asyncio.to_thread(_unload_asr_sync)


def status() -> dict:
    """Non-locking snapshot of model state — safe to call from /api/status."""
    return {
        "device": config.DEVICE,
        "asr_device": config.ASR_DEVICE,
        "tts_loaded": _tts_model is not None,
        "asr_loaded": _asr_model is not None,
        "asr_model_size": _asr_config[0] if _asr_config else None,
        "asr_compute_type": _asr_config[2] if _asr_config else None,
        "locked": _lock.locked(),
    }
