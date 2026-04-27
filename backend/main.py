from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import voices, inference, history, status, studio
import config

app = FastAPI(
    title="Voice Clone API",
    description="FastAPI backend for voice cloning with Qwen3-TTS",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Static mounts
app.mount("/voices-static", StaticFiles(directory=config.SAVED_VOICES_DIR), name="voices-static")
app.mount("/generated-static", StaticFiles(directory=config.GENERATED_DIR), name="generated-static")

# Routers
app.include_router(voices.router, prefix="/api", tags=["voices"])
app.include_router(inference.router, prefix="/api", tags=["inference"])
app.include_router(history.router, prefix="/api", tags=["history"])
app.include_router(status.router, prefix="/api", tags=["status"])
app.include_router(studio.router, prefix="/api", tags=["studio"])


@app.get("/")
async def root():
    return {
        "message": "Voice Clone API",
        "device": config.DEVICE,
        "endpoints": {
            "voices": "/api/voices",
            "transcribe": "/api/transcribe",
            "generate": "/api/generate",
            "convert": "/api/convert",
            "convert_finalize": "/api/convert/finalize",
            "history": "/api/history",
            "status": "/api/status",
            "subtitles": "/api/subtitles",
            "unload": "/api/unload",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    print(f"Using device: {config.DEVICE}")
    print(f"Saved voices directory: {config.SAVED_VOICES_DIR}")
    print(f"Generated directory: {config.GENERATED_DIR}")
    uvicorn.run(app, host="127.0.0.1", port=8000)
