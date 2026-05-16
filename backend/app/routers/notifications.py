from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.deps import OperatorDep, SupabaseDep
from app.models.schemas import NotificationSend
from app.services.notifications import NotificationService, format_amount
from app.services.payment_reference import build_reference
from app.services.expense_distribution import first_of_month

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/send")
def send_notification(body: NotificationSend, db: SupabaseDep, _: OperatorDep):
    unit = db.table("units").select("*, buildings(name)").eq("id", str(body.unit_id)).maybe_single().execute()
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

    NotificationService(db).notify_unit(
        unit.data,
        template_key=body.template_key,
        context={
            "amount": format_amount(amount),
            "month": month.strftime("%m/%Y"),
            "reference": ref,
            "subject": f"Ειδοποίηση — {unit.data.get('buildings', {}).get('name', '')}",
        },
        channels=body.channels,
        ledger_id=ledger.data["id"] if ledger.data else None,
    )
    return {"status": "sent"}
