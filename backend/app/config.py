from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    anthropic_api_key: str = ""
    revolut_api_key: str = ""
    revolut_webhook_secret: str = ""

    revolut_merchant_api_key: str = ""
    revolut_merchant_webhook_secret: str = ""
    revolut_merchant_api_version: str = "2024-09-01"
    revolut_merchant_base_url: str = "https://sandbox-merchant.revolut.com"
    revolut_payment_redirect_url: str = ""

    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@example.com"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    railway_cron_secret: str = ""
    frontend_url: str = "http://localhost:5173"


settings = Settings()
