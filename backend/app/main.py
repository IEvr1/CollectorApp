from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import buildings, expenses, notifications, revolut_oauth, units, webhooks

app = FastAPI(
    title="Cyprus Property Management API",
    version="0.1.0",
    description="Building management automation for Cyprus",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(buildings.router)
app.include_router(units.router)
app.include_router(expenses.router)
app.include_router(webhooks.router)
app.include_router(notifications.router)
app.include_router(revolut_oauth.router)


@app.get("/health")
def health():
    return {"status": "ok"}
