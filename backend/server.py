"""Vercel entrypoint — re-exports the FastAPI app from backend/app/main.py."""

import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from app.main import app  # noqa: E402

__all__ = ["app"]
