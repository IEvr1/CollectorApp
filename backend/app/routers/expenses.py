from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.deps import OperatorDep, SupabaseDep
from app.models.schemas import ExpenseCreate, ExpenseResponse
from app.services.expense_distribution import ExpenseDistributionService

router = APIRouter(tags=["expenses"])


@router.post("/buildings/{building_id}/expenses", response_model=ExpenseResponse)
def create_expense(building_id: UUID, body: ExpenseCreate, db: SupabaseDep, _: OperatorDep):
    b = db.table("buildings").select("id").eq("id", str(building_id)).maybe_single().execute()
    if not b.data:
        raise HTTPException(status_code=404, detail="Building not found")

    row = (
        db.table("expenses")
        .insert(
            {
                "building_id": str(building_id),
                "date": body.date.isoformat(),
                "category": body.category,
                "vendor": body.vendor,
                "amount": float(body.amount),
                "approved": True,
            }
        )
        .execute()
    )
    expense = row.data[0]

    try:
        ExpenseDistributionService(db).distribute(expense["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return expense


@router.get("/buildings/{building_id}/expenses", response_model=list[ExpenseResponse])
def list_expenses(building_id: UUID, db: SupabaseDep, _: OperatorDep):
    rows = (
        db.table("expenses")
        .select("*")
        .eq("building_id", str(building_id))
        .order("date", desc=True)
        .execute()
    )
    return rows.data or []


@router.patch("/expenses/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(expense_id: UUID, db: SupabaseDep, _: OperatorDep):
    row = (
        db.table("expenses")
        .update({"approved": True})
        .eq("id", str(expense_id))
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense = row.data[0]
    ExpenseDistributionService(db).distribute(expense["id"])
    return expense
