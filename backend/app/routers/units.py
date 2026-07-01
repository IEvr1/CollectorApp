from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

import base64

from app.db import serialize_row, serialize_rows
from app.deps import DbDep, OperatorDep
from app.models.schemas import UnitCreate, UnitResponse
from app.services.qr_payment import QRPaymentService

group_router = APIRouter(tags=["units"])
unit_router = APIRouter(tags=["units"])


@group_router.post("/{building_id}/units", response_model=UnitResponse)
def create_unit(building_id: UUID, body: UnitCreate, db: DbDep, _: OperatorDep):
    building = db.execute(
        "SELECT id, split_method FROM buildings WHERE id = %s",
        (str(building_id),),
    ).fetchone()
    if not building:
        raise HTTPException(status_code=404, detail="Group not found")

    split_method = building.get("split_method") or "by_area"
    if split_method == "by_area" and body.area_m2 is None:
        raise HTTPException(status_code=400, detail="area_m2 required for area-based split groups")

    row = db.execute(
        """
        INSERT INTO units (
            building_id, unit_number, owner_name, email, phone,
            area_m2, weight, floor, preferred_locale
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            str(building_id),
            body.unit_number,
            body.owner_name,
            str(body.email) if body.email else None,
            body.phone,
            float(body.area_m2) if body.area_m2 is not None else None,
            float(body.weight),
            body.floor,
            body.preferred_locale,
        ),
    ).fetchone()
    return serialize_row(row)


@group_router.get("/{building_id}/units", response_model=list[UnitResponse])
def list_units(building_id: UUID, db: DbDep, _: OperatorDep):
    rows = db.execute(
        "SELECT * FROM units WHERE building_id = %s ORDER BY unit_number",
        (str(building_id),),
    ).fetchall()
    return serialize_rows(rows)


@unit_router.get("/units/{unit_id}/payment-qr")
def unit_payment_qr(unit_id: UUID, db: DbDep, _: OperatorDep, month: str | None = None):
    try:
        data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return data


@unit_router.get("/units/{unit_id}/payment-qr.png")
def unit_payment_qr_image(unit_id: UUID, db: DbDep, _: OperatorDep, month: str | None = None):
    data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    png = base64.b64decode(data["qr_png_base64"])
    return Response(content=png, media_type="image/png")
