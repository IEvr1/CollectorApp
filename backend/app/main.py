import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_pool
from app.routers import auth, buildings, cron, expenses, notifications, revolut_oauth, units, webhooks


def _allowed_origins() -> list[str]:
    origins = {settings.frontend_url, "http://localhost:5173"}
    if url := os.getenv("VERCEL_URL"):
        origins.add(f"https://{url}")
    if url := os.getenv("VERCEL_BRANCH_URL"):
        origins.add(f"https://{url}")
    return sorted(origins)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    close_pool()


app = FastAPI(
    title="Collection Platform API",
    version="0.2.0",
    description="Collector intermediary for groups: charges, bank transfers, weekly committee payouts",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)

api.include_router(units.unit_router)
for prefix in ("/buildings", "/groups"):
    api.include_router(buildings.router, prefix=prefix)
    api.include_router(units.group_router, prefix=prefix)
    api.include_router(expenses.router, prefix=prefix)

api.include_router(webhooks.router)
api.include_router(notifications.router)
api.include_router(revolut_oauth.router)
api.include_router(cron.router)


@api.get("/health")
def health():
    return {"status": "ok"}


app.include_router(api)
