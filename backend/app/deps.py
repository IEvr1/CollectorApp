from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


SupabaseDep = Annotated[Client, Depends(get_supabase)]


async def get_current_operator(
    db: SupabaseDep,
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    token = authorization.removeprefix("Bearer ").strip()
    if not settings.supabase_jwt_secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="JWT not configured")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    op = db.table("operators").select("*").eq("id", user_id).maybe_single().execute()
    if not op.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an operator")

    return {"id": user_id, "email": op.data.get("email"), **op.data}


OperatorDep = Annotated[dict, Depends(get_current_operator)]


def verify_cron_secret(x_cron_secret: Annotated[str | None, Header()] = None) -> None:
    if not settings.railway_cron_secret:
        return
    if x_cron_secret != settings.railway_cron_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid cron secret")
