import hashlib
import hmac
import json


def verify_merchant_webhook(payload: bytes, signature: str | None, timestamp: str | None, secret: str) -> bool:
    """Revolut Merchant API: HMAC over v1.{timestamp}.{raw_payload}."""
    if not secret:
        return True
    if not signature or not timestamp:
        return False

    try:
        body = json.loads(payload)
        payload_str = json.dumps(body, separators=(",", ":"))
    except json.JSONDecodeError:
        payload_str = payload.decode("utf-8")

    signed = f"v1.{timestamp}.{payload_str}"
    expected = hmac.new(secret.encode(), signed.encode(), hashlib.sha256).hexdigest()

    for part in signature.split(","):
        part = part.strip()
        if part.startswith("v1=") and hmac.compare_digest(part[3:], expected):
            return True
    return False


def verify_business_webhook(payload: bytes, signature: str | None, secret: str) -> bool:
    """Revolut Business API legacy/simple HMAC of raw body (sandbox may vary)."""
    if not secret:
        return True
    if not signature:
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    sig = signature.strip()
    if sig.startswith("v1="):
        sig = sig[3:]
    return hmac.compare_digest(expected, sig)
