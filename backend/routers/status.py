import os
from fastapi import APIRouter

from services import model_manager

router = APIRouter()


def _rss_mb() -> float | None:
    try:
        import psutil  # type: ignore
        return round(psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024), 1)
    except Exception:
        return None


@router.get("/status")
async def status():
    return {
        **model_manager.status(),
        "rss_mb": _rss_mb(),
    }
