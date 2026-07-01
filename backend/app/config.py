import os
from decimal import Decimal
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py → repo root (so uvicorn cwd=backend still loads root .env)
_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT / ".env"), str(_ROOT / ".env.local"), str(_ROOT / "backend" / ".env")),
        extra="ignore",
    )

    database_url: str = ""
    jwt_secret: str = ""

    anthropic_api_key: str = ""
    revolut_api_key: str = ""
    revolut_webhook_secret: str = ""
    revolut_business_base_url: str = "https://sandbox-b2b.revolut.com"
    revolut_source_account_id: str = ""
    revolut_client_id: str = ""
    revolut_redirect_uri: str = ""

    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@example.com"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    cron_secret: str = ""
    payout_min_amount: Decimal = Decimal("50")
    payout_timezone: str = "Asia/Nicosia"
    frontend_url: str = "http://localhost:5173"

    @model_validator(mode="after")
    def apply_platform_defaults(self) -> "Settings":
        if not self.database_url:
            url = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")
            if url:
                object.__setattr__(self, "database_url", url)

        if self.frontend_url == "http://localhost:5173":
            if url := os.getenv("VERCEL_URL"):
                object.__setattr__(self, "frontend_url", f"https://{url}")

        if not self.revolut_redirect_uri and self.frontend_url.startswith("https://"):
            object.__setattr__(
                self,
                "revolut_redirect_uri",
                f"{self.frontend_url.rstrip('/')}/api/revolut/callback",
            )

        return self


settings = Settings()
