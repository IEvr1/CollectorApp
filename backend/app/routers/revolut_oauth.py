"""OAuth callback for Revolut Business API (displays authorization code)."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["revolut-oauth"])


@router.get("/revolut/callback", response_class=HTMLResponse)
def revolut_oauth_callback(code: str | None = None, error: str | None = None):
    if error:
        return f"<h1>Revolut OAuth error</h1><p>{error}</p>"
    if not code:
        return "<h1>Revolut OAuth</h1><p>No code in URL. Complete consent from Revolut first.</p>"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Revolut OAuth</title></head>
<body style="font-family:sans-serif;max-width:640px;margin:2rem auto;padding:1rem">
<h1>Authorization code received</h1>
<p>Copy this code (valid ~2 minutes), then run:</p>
<pre style="background:#f1f5f9;padding:1rem;overflow:auto">python scripts/revolut_exchange_token.py "{code}"</pre>
<p><strong>Code:</strong></p>
<pre style="background:#f1f5f9;padding:1rem;word-break:break-all">{code}</pre>
</body></html>"""
