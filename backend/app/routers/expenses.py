from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import serialize_row, serialize_rows
from app.deps import DbDep, OperatorDep
from app.models.schemas import ExpenseCreate, ExpenseResponse
from app.services.expense_distribution import ExpenseDistributionService

router = APIRouter(tags=["expenses"])


@router.post("/buildings/{building_id}/expenses", response_model=ExpenseResponse)
def create_expense(building_id: UUID, body: ExpenseCreate, db: DbDep, _: OperatorDep):
    exists = db.execute("SELECT id FROM buildings WHERE id = %s", (str(building_id),)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="Building not found")

    row = db.execute(
        """
        INSERT INTO expenses (building_id, date, category, vendor, amount, approved)
        VALUES (%s, %s, %s, %s, %s, true)
        RETURNING *
        """,
        (
            str(building_id),
            body.date.isoformat(),
            body.category,
            body.vendor,
            float(body.amount),
        ),
    ).fetchone()
    expense = serialize_row(row)

    try:
        ExpenseDistributionService(db).distribute(expense["id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return expense


@router.get("/buildings/{building_id}/expenses", response_model=list[ExpenseResponse])
def list_expenses(building_id: UUID, db: DbDep, _: OperatorDep):
    rows = db.execute(
        "SELECT * FROM expenses WHERE building_id = %s ORDER BY date DESC",
        (str(building_id),),
    ).fetchall()
    return serialize_rows(rows)


@router.patch("/expenses/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(expense_id: UUID, db: DbDep, _: OperatorDep):
    row = db.execute(
        "UPDATE expenses SET approved = true WHERE id = %s RETURNING *",
        (str(expense_id),),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense = serialize_row(row)
    ExpenseDistributionService(db).distribute(expense["id"])
    return expense
