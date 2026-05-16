from decimal import Decimal
from pathlib import Path
from typing import Any

from supabase import Client

from app.config import settings
from app.services.phone import normalize_cyprus_phone

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "sms"


def format_amount(amount: Decimal | float) -> str:
    return f"{float(amount):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _load_template(key: str, locale: str) -> str:
    path = TEMPLATES_DIR / f"{key}_{locale}.txt"
    if not path.exists():
        path = TEMPLATES_DIR / f"{key}_el.txt"
    return path.read_text(encoding="utf-8")


def format_amount(amount: Decimal | float) -> str:
    return f"{float(amount):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


class NotificationService:
    def __init__(self, db: Client):
        self.db = db

    def _log(
        self,
        *,
        unit_id: str | None,
        ledger_id: str | None,
        channel: str,
        template_key: str,
        recipient: str,
        status: str,
        error_message: str | None = None,
        twilio_sid: str | None = None,
        sendgrid_id: str | None = None,
    ) -> None:
        row: dict[str, Any] = {
            "unit_id": unit_id,
            "ledger_id": ledger_id,
            "channel": channel,
            "template_key": template_key,
            "recipient": recipient,
            "status": status,
            "error_message": error_message,
            "twilio_message_sid": twilio_sid,
            "sendgrid_message_id": sendgrid_id,
        }
        try:
            self.db.table("notification_log").insert(row).execute()
        except Exception:
            pass

    def _already_sent(self, ledger_id: str, template_key: str, channel: str) -> bool:
        r = (
            self.db.table("notification_log")
            .select("id")
            .eq("ledger_id", ledger_id)
            .eq("template_key", template_key)
            .eq("channel", channel)
            .eq("status", "sent")
            .limit(1)
            .execute()
        )
        return bool(r.data)

    def send_sms(
        self,
        to_phone: str,
        body: str,
        *,
        unit_id: str | None = None,
        ledger_id: str | None = None,
        template_key: str = "generic",
    ) -> bool:
        normalized = normalize_cyprus_phone(to_phone)
        if not normalized:
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="sms",
                template_key=template_key,
                recipient=to_phone or "",
                status="skipped",
                error_message="Invalid phone",
            )
            return False

        if ledger_id and self._already_sent(ledger_id, template_key, "sms"):
            return True

        if not settings.twilio_account_sid or not settings.twilio_auth_token:
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="sms",
                template_key=template_key,
                recipient=normalized,
                status="skipped",
                error_message="Twilio not configured",
            )
            return False

        try:
            from twilio.rest import Client as TwilioClient

            client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
            msg = client.messages.create(
                body=body,
                from_=settings.twilio_phone_number,
                to=normalized,
            )
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="sms",
                template_key=template_key,
                recipient=normalized,
                status="sent",
                twilio_sid=msg.sid,
            )
            return True
        except Exception as exc:
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="sms",
                template_key=template_key,
                recipient=normalized,
                status="failed",
                error_message=str(exc),
            )
            return False

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        *,
        unit_id: str | None = None,
        ledger_id: str | None = None,
        template_key: str = "generic",
    ) -> bool:
        if not to_email:
            return False

        if ledger_id and self._already_sent(ledger_id, template_key, "email"):
            return True

        if not settings.sendgrid_api_key:
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="email",
                template_key=template_key,
                recipient=to_email,
                status="skipped",
                error_message="SendGrid not configured",
            )
            return False

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=settings.sendgrid_from_email,
                to_emails=to_email,
                subject=subject,
                plain_text_content=body,
            )
            sg = SendGridAPIClient(settings.sendgrid_api_key)
            response = sg.send(message)
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="email",
                template_key=template_key,
                recipient=to_email,
                status="sent",
                sendgrid_id=str(response.status_code),
            )
            return True
        except Exception as exc:
            self._log(
                unit_id=unit_id,
                ledger_id=ledger_id,
                channel="email",
                template_key=template_key,
                recipient=to_email,
                status="failed",
                error_message=str(exc),
            )
            return False

    def notify_unit(
        self,
        unit: dict,
        *,
        template_key: str,
        context: dict,
        channels: list[str],
        ledger_id: str | None = None,
    ) -> None:
        locale = unit.get("preferred_locale") or "el"
        try:
            body_template = _load_template(template_key, locale)
        except FileNotFoundError:
            body_template = context.get("body", "")

        body = body_template.format(**context)
        subject = context.get("subject", "Πολυκατοικία — Ειδοποίηση")

        unit_id = unit.get("id")
        if "sms" in channels and unit.get("phone"):
            self.send_sms(
                unit["phone"],
                body,
                unit_id=unit_id,
                ledger_id=ledger_id,
                template_key=template_key,
            )
        if "email" in channels and unit.get("email"):
            self.send_email(
                unit["email"],
                subject,
                body,
                unit_id=unit_id,
                ledger_id=ledger_id,
                template_key=template_key,
            )
