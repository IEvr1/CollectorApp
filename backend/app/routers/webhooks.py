import hashlib
import json
from decimal import Decimal

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.deps import SupabaseDep
from app.services.payment_matching import PaymentMatchingService
from app.services.payment_reference import parse_reference
from app.services.revolut_merchant import RevolutMerchantClient
from app.services.revolut_signature import verify_business_webhook, verify_merchant_webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _parse_amount(payload: dict) -> Decimal:
    amount_raw = payload.get("amount") or (payload.get("legs") or [{}])[0].get("amount")
    if isinstance(amount_raw, dict):
        return Decimal(str(amount_raw.get("value", 0))) / Decimal(
            10 ** int(amount_raw.get("minor_units", 2) or 2)
        )
    if isinstance(amount_raw, int):
        return Decimal(amount_raw) / Decimal(100)
    return Decimal(str(amount_raw or 0))


@router.post("/revolut")
async def revolut_business_webhook(
    request: Request,
    db: SupabaseDep,
    revolut_signature: str | None = Header(None, alias="Revolut-Signature"),
):
    body = await request.body()
    if settings.revolut_webhook_secret and not verify_business_webhook(
        body, revolut_signature, settings.revolut_webhook_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event = data.get("event") or data.get("type") or ""
    payload = data.get("data") or data

    amount = _parse_amount(payload)
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
        external_id=str(tx_id),
        payment_method="bank_transfer",
    )
    return result


@router.post("/revolut-merchant")
async def revolut_merchant_webhook(
    request: Request,
    db: SupabaseDep,
    revolut_signature: str | None = Header(None, alias="Revolut-Signature"),
    revolut_request_timestamp: str | None = Header(None, alias="Revolut-Request-Timestamp"),
):
    body = await request.body()
    if settings.revolut_merchant_webhook_secret and not verify_merchant_webhook(
        body,
        revolut_signature,
        revolut_request_timestamp,
        settings.revolut_merchant_webhook_secret,
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event = (data.get("event") or "").upper()
    if event not in ("ORDER_COMPLETED", "ORDER_AUTHORISED"):
        return {"status": "ignored", "event": event}

    order_id = data.get("order_id") or data.get("id")
    if not order_id:
        raise HTTPException(status_code=400, detail="Missing order_id")

    reference = data.get("merchant_order_ext_ref") or data.get("merchant_order_reference") or ""

    amount = Decimal("0")
    client = RevolutMerchantClient()
    if client.configured:
        try:
            order = await client.get_order(str(order_id))
            reference = (
                reference
                or (order.get("merchant_order_data") or {}).get("reference")
                or ""
            )
            raw_amount = order.get("amount")
            if isinstance(raw_amount, int):
                amount = Decimal(raw_amount) / Decimal(100)
        except Exception:
            pass

    if amount <= 0:
        amount = _parse_amount(data)

    if not reference:
        raise HTTPException(status_code=400, detail="Missing payment reference on order")

    if not parse_reference(reference):
        raise HTTPException(status_code=400, detail="Invalid payment reference format")

    result = PaymentMatchingService(db).process_payment(
        amount=amount,
        reference=reference,
        external_id=str(order_id),
        payment_method="payment_link",
        merchant_order_id=str(order_id),
    )
    return result
