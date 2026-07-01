from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db import serialize_row, serialize_rows
from app.deps import DbDep, OperatorDep
from app.models.schemas import (
    BuildingCreate,
    BuildingDashboard,
    BuildingPayoutConfigUpdate,
    BuildingPayoutSummary,
    BuildingResponse,
    PayoutBatchResponse,
)
from app.services.dates import first_of_month
from app.services.payout import PayoutService

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.post("", response_model=BuildingResponse)
def create_building(body: BuildingCreate, db: DbDep, _: OperatorDep):
    row = db.execute(
        """
        INSERT INTO buildings (name, address, virtual_iban, monthly_budget, reserve_fund_target)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            body.name,
            body.address,
            body.virtual_iban,
            float(body.monthly_budget),
            float(body.reserve_fund_target),
        ),
    ).fetchone()
    return serialize_row(row)


@router.get("", response_model=list[BuildingResponse])
def list_buildings(db: DbDep, _: OperatorDep):
    rows = db.execute("SELECT * FROM buildings ORDER BY name").fetchall()
    return serialize_rows(rows)


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(building_id: UUID, db: DbDep, _: OperatorDep):
    row = db.execute("SELECT * FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Building not found")
    return serialize_row(row)


@router.get("/{building_id}/dashboard", response_model=BuildingDashboard)
def building_dashboard(building_id: UUID, db: DbDep, _: OperatorDep):
    building = db.execute("SELECT * FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    month = first_of_month().isoformat()
    units = db.execute(
        "SELECT * FROM units WHERE building_id = %s",
        (str(building_id),),
    ).fetchall()
    ledger = db.execute(
        """
        SELECT * FROM ledger
        WHERE building_id = %s AND month = %s AND line_type = 'common_expense'
        """,
        (str(building_id), month),
    ).fetchall()

    ledger_by_unit = {str(r["unit_id"]): r for r in ledger}
    collected = Decimal("0")
    outstanding = Decimal("0")
    paid_count = 0
    unit_rows = []

    for u in units:
        entry = ledger_by_unit.get(str(u["id"]))
        balance = Decimal(str(entry["balance"])) if entry else Decimal("0")
        due = Decimal(str(entry["amount_due"])) if entry else Decimal("0")
        paid = Decimal(str(entry["amount_paid"])) if entry else Decimal("0")
        status_val = entry["status"] if entry else "pending"

        collected += paid
        outstanding += max(balance, Decimal("0"))
        if status_val == "paid":
            paid_count += 1

        unit_data = serialize_row(u)
        unit_rows.append(
            {
                **unit_data,
                "ledger": serialize_row(entry) if entry else None,
                "balance": float(balance),
                "status": status_val,
            }
        )

    return BuildingDashboard(
        building=serialize_row(building),
        collected_this_month=collected,
        outstanding=outstanding,
        units_paid=paid_count,
        units_total=len(units),
        units=unit_rows,
    )


@router.get("/{building_id}/ledger")
def building_ledger(
    building_id: UUID,
    db: DbDep,
    _: OperatorDep,
    month: date | None = None,
):
    m = (month or first_of_month()).isoformat()
    rows = db.execute(
        """
        SELECT l.*, u.unit_number, u.owner_name
        FROM ledger l
        JOIN units u ON u.id = l.unit_id
        WHERE l.building_id = %s AND l.month = %s
        ORDER BY l.unit_id
        """,
        (str(building_id), m),
    ).fetchall()
    result = []
    for row in rows:
        item = serialize_row(row)
        item["units"] = {"unit_number": item.pop("unit_number"), "owner_name": item.pop("owner_name")}
        result.append(item)
    return result


@router.get("/{building_id}/payments")
def building_payments(building_id: UUID, db: DbDep, _: OperatorDep):
    rows = db.execute(
        """
        SELECT p.id, p.amount, p.received_at, p.matched, p.payment_method,
               p.collected_at, p.paid_out_at, p.payout_batch_id, u.unit_number
        FROM payments p
        LEFT JOIN units u ON u.id = p.unit_id
        WHERE p.building_id = %s
        ORDER BY p.received_at DESC
        LIMIT 100
        """,
        (str(building_id),),
    ).fetchall()
    result = []
    for row in rows:
        item = serialize_row(row)
        unit_number = item.pop("unit_number", None)
        if unit_number:
            item["units"] = {"unit_number": unit_number}
        result.append(item)
    return result


@router.patch("/{building_id}/payout-config", response_model=BuildingResponse)
def update_payout_config(
    building_id: UUID,
    body: BuildingPayoutConfigUpdate,
    db: DbDep,
    _: OperatorDep,
):
    exists = db.execute("SELECT id FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Building not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{key} = %s" for key in updates)
    values = list(updates.values()) + [str(building_id)]
    row = db.execute(
        f"UPDATE buildings SET {set_clause} WHERE id = %s RETURNING *",
        values,
    ).fetchone()
    return serialize_row(row)


@router.get("/{building_id}/payouts", response_model=list[PayoutBatchResponse])
def building_payouts(building_id: UUID, db: DbDep, _: OperatorDep):
    exists = db.execute("SELECT id FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Building not found")

    rows = db.execute(
        """
        SELECT * FROM payout_batches
        WHERE building_id = %s
        ORDER BY scheduled_for DESC
        LIMIT 52
        """,
        (str(building_id),),
    ).fetchall()
    return serialize_rows(rows)


@router.get("/{building_id}/payout-summary", response_model=BuildingPayoutSummary)
def building_payout_summary(building_id: UUID, db: DbDep, _: OperatorDep):
    building = db.execute("SELECT * FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    service = PayoutService(db)
    pending = service.pending_amount(str(building_id))

    last = db.execute(
        """
        SELECT * FROM payout_batches
        WHERE building_id = %s AND status = 'completed'
        ORDER BY scheduled_for DESC
        LIMIT 1
        """,
        (str(building_id),),
    ).fetchone()

    building_data = serialize_row(building)
    return BuildingPayoutSummary(
        pending_amount=pending,
        minimum_payout=settings.payout_min_amount,
        payout_enabled=bool(building_data.get("payout_enabled")),
        last_payout=serialize_row(last),
    )
