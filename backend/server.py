"""Vercel entrypoint — re-exports the FastAPI app from backend/app/main.py."""

from app.main import app

__all__ = ["app"]
