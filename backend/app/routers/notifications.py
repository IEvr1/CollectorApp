from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import serialize_row
from app.deps import DbDep, OperatorDep
from app.models.schemas import NotificationSend
from app.services.dates import first_of_month
from app.services.notifications import NotificationService, format_amount
from app.services.payment_instructions import build_charge_context
from app.services.payment_reference import build_reference

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/send")
def send_notification(body: NotificationSend, db: DbDep, _: OperatorDep):
    row = db.execute(
        """
        SELECT u.*, b.name AS building_name, b.virtual_iban AS building_virtual_iban
        FROM units u
        JOIN buildings b ON b.id = u.building_id
        WHERE u.id = %s
        """,
        (str(body.unit_id),),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")

    unit_data = serialize_row(row)
    building = {
        "name": unit_data.pop("building_name"),
        "virtual_iban": unit_data.pop("building_virtual_iban"),
    }
    unit_data["buildings"] = building

    month = first_of_month()
    ref = build_reference(unit_data["building_id"], unit_data["id"], month)
    ledger = db.execute(
        """
        SELECT id, balance, amount_due FROM ledger
        WHERE unit_id = %s AND month = %s
        LIMIT 1
        """,
        (str(body.unit_id), month.isoformat()),
    ).fetchone()
    ledger_data = serialize_row(ledger)
    amount = ledger_data.get("balance") if ledger_data else 0

    locale = unit_data.get("preferred_locale") or "el"
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
        unit_data,
        template_key=body.template_key,
        context=context,
        channels=body.channels,
        ledger_id=ledger_data["id"] if ledger_data else None,
    )
    return {"status": "sent"}
