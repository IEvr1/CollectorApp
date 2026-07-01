from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.auth import create_access_token, verify_password
from app.db import serialize_row
from app.deps import DbDep


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: DbDep):
    row = db.execute(
        "SELECT * FROM operators WHERE email = %s",
        (str(body.email),),
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    operator = serialize_row(row)
    token = create_access_token(operator["id"], operator["email"])
    return LoginResponse(access_token=token)
