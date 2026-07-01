import hashlib
import hmac


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
