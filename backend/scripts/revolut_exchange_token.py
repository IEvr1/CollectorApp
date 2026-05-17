#!/usr/bin/env python3
"""Exchange Revolut Business OAuth authorization code for access token."""

import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

# Run from backend/:  python scripts/revolut_exchange_token.py <CODE>

ROOT = Path(__file__).resolve().parents[2]
CERT_DIR = ROOT / "revolut-certs"
PRIVATE_KEY = CERT_DIR / "privatecert.pem"


def base64url_encode(data: bytes) -> str:
    import base64

    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())


def build_jwt(client_id: str, redirect_uri: str) -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    iss = urlparse(redirect_uri).hostname or "localhost"
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": iss,
        "sub": client_id,
        "aud": "https://revolut.com",
        "exp": int(time.time()) + 40 * 60,
    }
    segments = [
        base64url_encode(json.dumps(header, separators=(",", ":")).encode()),
        base64url_encode(json.dumps(payload, separators=(",", ":")).encode()),
    ]
    signing_input = ".".join(segments).encode()
    key = serialization.load_pem_private_key(PRIVATE_KEY.read_bytes(), password=None)
    signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    segments.append(base64url_encode(signature))
    return ".".join(segments)


def main() -> None:
    load_env()
    if len(sys.argv) < 2:
        print("Usage: python scripts/revolut_exchange_token.py <AUTHORIZATION_CODE>")
        sys.exit(1)

    code = sys.argv[1].strip()
    client_id = os.environ.get("REVOLUT_CLIENT_ID", "").strip()
    redirect_uri = os.environ.get(
        "REVOLUT_REDIRECT_URI", "http://localhost:8000/revolut/callback"
    ).strip()

    if not client_id:
        print("Set REVOLUT_CLIENT_ID in .env (from Revolut Business API certificate page)")
        sys.exit(1)
    if not PRIVATE_KEY.exists():
        print(f"Missing {PRIVATE_KEY}")
        sys.exit(1)

    jwt = build_jwt(client_id, redirect_uri)
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        "client_assertion": jwt,
    }

    resp = httpx.post(
        "https://sandbox-b2b.revolut.com/api/1.0/auth/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30.0,
    )
    print(resp.status_code, resp.text)
    if resp.status_code == 200:
        token = resp.json().get("access_token")
        print("\nAdd to .env:\nREVOLUT_API_KEY=" + token)


if __name__ == "__main__":
    main()
