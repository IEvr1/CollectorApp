from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

import base64

from app.db import serialize_row, serialize_rows
from app.deps import DbDep, OperatorDep
from app.models.schemas import UnitCreate, UnitResponse
from app.services.qr_payment import QRPaymentService

router = APIRouter(tags=["units"])


@router.post("/buildings/{building_id}/units", response_model=UnitResponse)
def create_unit(building_id: UUID, body: UnitCreate, db: DbDep, _: OperatorDep):
    exists = db.execute("SELECT id FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Building not found")

    row = db.execute(
        """
        INSERT INTO units (
            building_id, unit_number, owner_name, email, phone,
            area_m2, floor, preferred_locale
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            str(building_id),
            body.unit_number,
            body.owner_name,
            str(body.email) if body.email else None,
            body.phone,
            float(body.area_m2),
            body.floor,
            body.preferred_locale,
        ),
    ).fetchone()
    return serialize_row(row)


@router.get("/buildings/{building_id}/units", response_model=list[UnitResponse])
def list_units(building_id: UUID, db: DbDep, _: OperatorDep):
    rows = db.execute(
        "SELECT * FROM units WHERE building_id = %s ORDER BY unit_number",
        (str(building_id),),
    ).fetchall()
    return serialize_rows(rows)


@router.get("/units/{unit_id}/payment-qr")
def unit_payment_qr(unit_id: UUID, db: DbDep, _: OperatorDep, month: str | None = None):
    try:
        data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return data


@router.get("/units/{unit_id}/payment-qr.png")
def unit_payment_qr_image(unit_id: UUID, db: DbDep, _: OperatorDep, month: str | None = None):
    data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    png = base64.b64decode(data["qr_png_base64"])
    return Response(content=png, media_type="image/png")
