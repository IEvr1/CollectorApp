from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.deps import OperatorDep, SupabaseDep
from app.models.schemas import BuildingCreate, BuildingDashboard, BuildingResponse
from app.services.expense_distribution import first_of_month

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.post("", response_model=BuildingResponse)
def create_building(body: BuildingCreate, db: SupabaseDep, _: OperatorDep):
    row = (
        db.table("buildings")
        .insert(
            {
                "name": body.name,
                "address": body.address,
                "virtual_iban": body.virtual_iban,
                "monthly_budget": float(body.monthly_budget),
                "reserve_fund_target": float(body.reserve_fund_target),
            }
        )
        .execute()
    )
    return row.data[0]


@router.get("", response_model=list[BuildingResponse])
def list_buildings(db: SupabaseDep, _: OperatorDep):
    rows = db.table("buildings").select("*").order("name").execute()
    return rows.data or []


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(building_id: UUID, db: SupabaseDep, _: OperatorDep):
    row = db.table("buildings").select("*").eq("id", str(building_id)).maybe_single().execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Building not found")
    return row.data


@router.get("/{building_id}/dashboard", response_model=BuildingDashboard)
def building_dashboard(building_id: UUID, db: SupabaseDep, _: OperatorDep):
    building = db.table("buildings").select("*").eq("id", str(building_id)).maybe_single().execute()
    if not building.data:
        raise HTTPException(status_code=404, detail="Building not found")

    month = first_of_month().isoformat()
    units = db.table("units").select("*").eq("building_id", str(building_id)).execute().data or []
    ledger = (
        db.table("ledger")
        .select("*")
        .eq("building_id", str(building_id))
        .eq("month", month)
        .eq("line_type", "common_expense")
        .execute()
    ).data or []

    ledger_by_unit = {r["unit_id"]: r for r in ledger}
    collected = Decimal("0")
    outstanding = Decimal("0")
    paid_count = 0
    unit_rows = []

    for u in units:
        entry = ledger_by_unit.get(u["id"])
        balance = Decimal(str(entry["balance"])) if entry else Decimal("0")
        due = Decimal(str(entry["amount_due"])) if entry else Decimal("0")
        paid = Decimal(str(entry["amount_paid"])) if entry else Decimal("0")
        status = entry["status"] if entry else "pending"

        collected += paid
        outstanding += max(balance, Decimal("0"))
        if status == "paid":
            paid_count += 1

        unit_rows.append(
            {
                **u,
                "ledger": entry,
                "balance": float(balance),
                "status": status,
            }
        )

    return BuildingDashboard(
        building=building.data,
        collected_this_month=collected,
        outstanding=outstanding,
        units_paid=paid_count,
        units_total=len(units),
        units=unit_rows,
    )


@router.get("/{building_id}/ledger")
def building_ledger(
    building_id: UUID,
    db: SupabaseDep,
    _: OperatorDep,
    month: date | None = None,
):
    m = (month or first_of_month()).isoformat()
    rows = (
        db.table("ledger")
        .select("*, units(unit_number, owner_name)")
        .eq("building_id", str(building_id))
        .eq("month", m)
        .order("unit_id")
        .execute()
    )
    return rows.data or []


@router.get("/{building_id}/payments")
def building_payments(building_id: UUID, db: SupabaseDep, _: OperatorDep):
    rows = (
        db.table("payments")
        .select("*, units(unit_number)")
        .eq("building_id", str(building_id))
        .order("received_at", desc=True)
        .limit(100)
        .execute()
    )
    return rows.data or []
