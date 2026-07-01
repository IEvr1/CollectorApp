from typing import Annotated

import psycopg
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt

from app.config import settings
from app.db import get_db, serialize_row


DbDep = Annotated[psycopg.Connection, Depends(get_db)]


async def get_current_operator(
    db: DbDep,
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = authorization.removeprefix("Bearer ").strip()
    if not settings.jwt_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWT not configured")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    row = db.execute(
        "SELECT * FROM operators WHERE id = %s",
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an operator")

    op = serialize_row(row)
    return {"id": user_id, "email": op.get("email"), **op}


OperatorDep = Annotated[dict, Depends(get_current_operator)]


def verify_cron_secret(
    authorization: Annotated[str | None, Header()] = None,
    x_cron_secret: Annotated[str | None, Header()] = None,
) -> None:
    """Accept Vercel Cron (`Authorization: Bearer …`) or manual `X-Cron-Secret` header."""
    secret = settings.cron_secret
    if not secret:
        return
    if authorization == f"Bearer {secret}":
        return
    if x_cron_secret == secret:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid cron secret")
