import os
import time
import asyncio
import tempfile
from pathlib import Path
from typing import Awaitable, Callable

STORAGE_STATE = Path.home() / ".notebooklm" / "storage_state.json"


def is_authenticated() -> bool:
    return STORAGE_STATE.exists()


async def generate_podcast_audio(
    sources: list[str],
    instructions: str,
    audio_format: str = "deep_dive",
    language: str = "en",
    auto_delete: bool = True,
    progress_cb: Callable[[float, str], Awaitable[None]] | None = None,
) -> bytes:
    """
    Creates a NotebookLM notebook, adds sources, generates a podcast with
    the given instructions, polls until complete, downloads audio, returns
    raw MP4/audio bytes. Deletes the notebook afterward if auto_delete=True.
    progress_cb: async def cb(value: float, desc: str)
    """
    try:
        from notebooklm import NotebookLMClient
        from notebooklm.rpc.types import AudioFormat, AudioLength
    except ImportError:
        raise RuntimeError(
            "notebooklm-py is not installed. Run: pip install 'notebooklm-py[browser]'"
        )

    if not is_authenticated():
        raise RuntimeError(
            "Not logged into NotebookLM. Run 'notebooklm login' in your terminal first."
        )

    FORMAT_MAP = {
        "deep_dive": AudioFormat.DEEP_DIVE,
        "brief": AudioFormat.BRIEF,
        "critique": AudioFormat.CRITIQUE,
        "debate": AudioFormat.DEBATE,
    }
    fmt = FORMAT_MAP.get(audio_format, AudioFormat.DEEP_DIVE)

    nb_id: str | None = None
    tmp_path: str | None = None

    try:
        if progress_cb:
            await progress_cb(0.02, "Connecting to NotebookLM...")

        async with await NotebookLMClient.from_storage() as client:
            if progress_cb:
                await progress_cb(0.04, "Creating notebook...")
            nb = await client.notebooks.create("VoiceClone Studio")
            nb_id = nb.id

            url_srcs = [s for s in sources if s.startswith(("http://", "https://"))]
            text_srcs = [s for s in sources if not s.startswith(("http://", "https://"))]
            total = max(len(url_srcs) + len(text_srcs), 1)

            for i, url in enumerate(url_srcs):
                if progress_cb:
                    await progress_cb(0.05 + 0.05 * (i / total), f"Adding source {i + 1}/{total}...")
                await client.sources.add_url(nb.id, url, wait=True)

            for i, text in enumerate(text_srcs):
                idx = len(url_srcs) + i
                if progress_cb:
                    await progress_cb(0.05 + 0.05 * (idx / total), f"Adding source {idx + 1}/{total}...")
                await client.sources.add_text(nb.id, text, wait=True)

            if progress_cb:
                await progress_cb(0.12, "Requesting podcast generation from NotebookLM...")

            status = await client.artifacts.generate_audio(
                nb.id,
                audio_format=fmt,
                audio_length=AudioLength.DEFAULT,
                language=language,
                instructions=instructions.strip() or None,
            )

            start = time.monotonic()
            MAX_WAIT = 900  # 15 min

            while True:
                elapsed = time.monotonic() - start
                if elapsed > MAX_WAIT:
                    raise TimeoutError("NotebookLM timed out after 15 minutes")

                mins, secs = divmod(int(elapsed), 60)
                poll_val = 0.15 + min(elapsed / MAX_WAIT, 1.0) * 0.32
                if progress_cb:
                    await progress_cb(poll_val, f"NotebookLM generating... {mins}:{secs:02d} elapsed")

                try:
                    final = await asyncio.wait_for(
                        client.artifacts.wait_for_completion(nb.id, status.task_id, timeout=6),
                        timeout=8,
                    )
                    if getattr(final, "is_complete", False):
                        break
                except Exception:
                    pass

                await asyncio.sleep(3)

            if progress_cb:
                await progress_cb(0.50, "Downloading podcast audio...")

            fd, tmp_path = tempfile.mkstemp(suffix=".mp4")
            os.close(fd)
            await client.artifacts.download_audio(nb.id, tmp_path)

            if auto_delete:
                try:
                    await client.notebooks.delete(nb.id)
                    nb_id = None
                except Exception:
                    pass

        with open(tmp_path, "rb") as f:
            return f.read()

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
