from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

import base64

from app.deps import OperatorDep, SupabaseDep
from app.models.schemas import PaymentLinkResponse, UnitCreate, UnitResponse
from app.services.payment_link import PaymentLinkService
from app.services.qr_payment import QRPaymentService
from app.services.revolut_merchant import RevolutMerchantError

router = APIRouter(tags=["units"])


@router.post("/buildings/{building_id}/units", response_model=UnitResponse)
def create_unit(building_id: UUID, body: UnitCreate, db: SupabaseDep, _: OperatorDep):
    b = db.table("buildings").select("id").eq("id", str(building_id)).maybe_single().execute()
    if not b.data:
        raise HTTPException(status_code=404, detail="Building not found")

    row = (
        db.table("units")
        .insert(
            {
                "building_id": str(building_id),
                "unit_number": body.unit_number,
                "owner_name": body.owner_name,
                "email": str(body.email) if body.email else None,
                "phone": body.phone,
                "area_m2": float(body.area_m2),
                "floor": body.floor,
                "preferred_locale": body.preferred_locale,
            }
        )
        .execute()
    )
    return row.data[0]


@router.get("/buildings/{building_id}/units", response_model=list[UnitResponse])
def list_units(building_id: UUID, db: SupabaseDep, _: OperatorDep):
    rows = (
        db.table("units")
        .select("*")
        .eq("building_id", str(building_id))
        .order("unit_number")
        .execute()
    )
    return rows.data or []


@router.get("/units/{unit_id}/payment-qr")
def unit_payment_qr(unit_id: UUID, db: SupabaseDep, _: OperatorDep, month: str | None = None):
    try:
        data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return data


@router.get("/units/{unit_id}/payment-qr.png")
def unit_payment_qr_image(unit_id: UUID, db: SupabaseDep, _: OperatorDep, month: str | None = None):
    data = QRPaymentService(db).get_payment_qr(str(unit_id), month)
    png = base64.b64decode(data["qr_png_base64"])
    return Response(content=png, media_type="image/png")


@router.post("/units/{unit_id}/payment-link", response_model=PaymentLinkResponse)
def create_payment_link(
    unit_id: UUID,
    db: SupabaseDep,
    _: OperatorDep,
    month: str | None = None,
    force_new: bool = False,
):
    try:
        data = PaymentLinkService(db).create_for_unit_sync(str(unit_id), month, force_new=force_new)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RevolutMerchantError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return data


@router.get("/units/{unit_id}/payment-link", response_model=PaymentLinkResponse)
def get_payment_link(unit_id: UUID, db: SupabaseDep, _: OperatorDep, month: str | None = None):
    svc = PaymentLinkService(db)
    existing = svc.get_active_link(str(unit_id), month)
    if existing:
        return {
            "checkout_url": existing["checkout_url"],
            "order_id": existing["revolut_order_id"],
            "reference": existing["merchant_reference"],
            "amount": float(existing["amount"]),
            "currency": existing["currency"],
            "reused": True,
        }
    try:
        return svc.create_for_unit_sync(str(unit_id), month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RevolutMerchantError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
