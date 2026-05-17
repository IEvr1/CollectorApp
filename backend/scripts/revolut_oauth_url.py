#!/usr/bin/env python3
"""Print the Revolut Business OAuth consent URL (redirect_uri URL-encoded)."""

import os
import sys
from urllib.parse import quote

# Run from backend/:  python scripts/revolut_oauth_url.py

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
url = (
    "https://sandbox-business.revolut.com/app-confirm"
    f"?client_id={CLIENT_ID}"
    f"&response_type=code"
    f"&redirect_uri={encoded}"
)
print("Open this URL in your browser (must match Revolut certificate exactly):\n")
print(url)
print(f"\nRegistered redirect URI must be: {REDIRECT_URI}")
print(f"JWT iss claim when exchanging token: {REDIRECT_URI.split('://')[1].split('/')[0]}")
