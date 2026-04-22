from fastapi import APIRouter, HTTPException

from services import history as history_svc

router = APIRouter()


@router.get("/history")
async def list_history(limit: int = 100):
    return {"items": history_svc.list_history(limit=limit)}


@router.delete("/history/{entry_id}")
async def delete_entry(entry_id: str):
    if not history_svc.delete_entry(entry_id):
        raise HTTPException(404, f"History entry '{entry_id}' not found")
    return {"deleted": entry_id}


@router.delete("/history")
async def clear_all():
    return {"deleted_count": history_svc.clear_all()}
