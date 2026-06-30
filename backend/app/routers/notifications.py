from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.deps import OperatorDep, SupabaseDep
from app.models.schemas import NotificationSend
from app.services.dates import first_of_month
from app.services.notifications import NotificationService, format_amount
from app.services.payment_instructions import build_charge_context
from app.services.payment_reference import build_reference

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/send")
def send_notification(body: NotificationSend, db: SupabaseDep, _: OperatorDep):
    unit = (
        db.table("units")
        .select("*, buildings(name, virtual_iban)")
        .eq("id", str(body.unit_id))
        .maybe_single()
        .execute()
    )
    if not unit.data:
        raise HTTPException(status_code=404, detail="Unit not found")

    month = first_of_month()
    ref = build_reference(unit.data["building_id"], unit.data["id"], month)
    ledger = (
        db.table("ledger")
        .select("id, balance, amount_due")
        .eq("unit_id", str(body.unit_id))
        .eq("month", month.isoformat())
        .maybe_single()
        .execute()
    )
    amount = ledger.data.get("balance") if ledger.data else 0

    building = unit.data.get("buildings") or {}
    locale = unit.data.get("preferred_locale") or "el"
    if body.template_key == "charge_notice":
        context = build_charge_context(
            amount=format_amount(amount),
            month=month.strftime("%m/%Y"),
            reference=ref,
            iban=building.get("virtual_iban") or "",
            locale=locale,
        )
    else:
        context = {
            "amount": format_amount(amount),
            "month": month.strftime("%m/%Y"),
            "reference": ref,
        }
    context["subject"] = f"Ειδοποίηση — {building.get('name', '')}"

    NotificationService(db).notify_unit(
        unit.data,
        template_key=body.template_key,
        context=context,
        channels=body.channels,
        ledger_id=ledger.data["id"] if ledger.data else None,
    )
    return {"status": "sent"}
