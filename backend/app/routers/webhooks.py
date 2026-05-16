import hashlib
import hmac
import json
from decimal import Decimal

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.deps import SupabaseDep
from app.services.payment_matching import PaymentMatchingService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def verify_revolut_signature(payload: bytes, signature: str | None, secret: str) -> bool:
    if not secret or not signature:
        return not secret  # allow dev without secret
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/revolut")
async def revolut_webhook(
    request: Request,
    db: SupabaseDep,
    revolut_signature: str | None = Header(None, alias="Revolut-Signature"),
):
    body = await request.body()
    if settings.revolut_webhook_secret and not verify_revolut_signature(
        body, revolut_signature, settings.revolut_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event = data.get("event") or data.get("type") or ""
    payload = data.get("data") or data

    amount_raw = payload.get("amount") or payload.get("legs", [{}])[0].get("amount")
    if isinstance(amount_raw, dict):
        amount = Decimal(str(amount_raw.get("value", 0))) / Decimal(
            10 ** int(amount_raw.get("minor_units", 2) or 2)
        )
    else:
        amount = Decimal(str(amount_raw or 0))

    reference = (
        payload.get("reference")
        or payload.get("description")
        or payload.get("merchant_order_id")
        or ""
    )
    virtual_iban = (
        payload.get("virtual_iban")
        or payload.get("account_id")
        or (payload.get("legs") or [{}])[0].get("account_id")
    )
    tx_id = (
        payload.get("id")
        or payload.get("transaction_id")
        or data.get("id")
        or hashlib.sha256(body).hexdigest()
    )

    if "completed" not in str(event).lower() and event not in ("TransactionCreated", ""):
        return {"status": "ignored", "event": event}

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    result = PaymentMatchingService(db).process_payment(
        amount=amount,
        virtual_iban=virtual_iban,
        reference=str(reference),
        revolut_transaction_id=str(tx_id),
    )
    return result
