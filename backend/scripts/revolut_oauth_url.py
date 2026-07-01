#!/usr/bin/env python3
"""Print the Revolut Business OAuth consent URL (redirect_uri URL-encoded)."""

import os
import sys
from pathlib import Path
from urllib.parse import quote

# Run from backend/:  python scripts/revolut_oauth_url.py

ROOT = Path(__file__).resolve().parents[2]


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


load_env()

CLIENT_ID = os.environ.get("REVOLUT_CLIENT_ID", "").strip()
REDIRECT_URI = os.environ.get(
    "REVOLUT_REDIRECT_URI", "http://localhost:8000/revolut/callback"
).strip()

if len(sys.argv) > 1:
    CLIENT_ID = sys.argv[1]
if len(sys.argv) > 2:
    REDIRECT_URI = sys.argv[2]

if not CLIENT_ID:
    print("Usage: set REVOLUT_CLIENT_ID in .env or:")
    print("  python scripts/revolut_oauth_url.py <CLIENT_ID> [REDIRECT_URI]")
    sys.exit(1)

encoded = quote(REDIRECT_URI, safe="")
# Parameter order matches Revolut docs (client_id, redirect_uri, response_type).
url = (
    "https://sandbox-business.revolut.com/app-confirm"
    f"?client_id={CLIENT_ID}"
    f"&redirect_uri={encoded}"
    f"&response_type=code"
)
print("Open this URL in your browser (must match Revolut certificate exactly):\n")
print(url)
print(f"\nRegistered redirect URI must be: {REDIRECT_URI}")
print(f"JWT iss claim when exchanging token: {REDIRECT_URI.split('://')[1].split('/')[0]}")
