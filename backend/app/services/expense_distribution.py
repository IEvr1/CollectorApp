from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import psycopg

from app.db import serialize_row
from app.services.dates import first_of_month
from app.services.notifications import NotificationService, format_amount
from app.services.payment_instructions import build_charge_context
from app.services.payment_reference import build_reference


def default_due_date(month: date) -> date:
    _, last = monthrange(month.year, month.month)
    return month.replace(day=min(15, last))


def compute_status(amount_due: Decimal, amount_paid: Decimal, due_date: date | None) -> str:
    if amount_paid >= amount_due and amount_due > 0:
        return "paid"
    if due_date and date.today() > due_date:
        return "overdue"
    return "pending"


class ExpenseDistributionService:
    def __init__(self, db: psycopg.Connection):
        self.db = db
        self.notifications = NotificationService(db)

    def distribute(self, expense_id: str) -> dict:
        expense = self.db.execute(
            "SELECT * FROM expenses WHERE id = %s",
            (expense_id,),
        ).fetchone()
        if not expense or not expense.get("approved", True):
            raise ValueError("Expense not found or not approved")
        expense = serialize_row(expense)

        building = self.db.execute(
            "SELECT * FROM buildings WHERE id = %s",
            (expense["building_id"],),
        ).fetchone()
        building = serialize_row(building)

        units = self.db.execute(
            "SELECT * FROM units WHERE building_id = %s",
            (expense["building_id"],),
        ).fetchall()
        units = [serialize_row(u) for u in units]

        total_area = Decimal(str(building.get("total_area_m2") or 0))
        if total_area <= 0:
            raise ValueError("Building has no unit areas configured")

        amount = Decimal(str(expense["amount"]))
        month = first_of_month(
            date.fromisoformat(expense["date"])
            if isinstance(expense["date"], str)
            else expense["date"]
        )
        due = default_due_date(month)
        updated = []

        for unit in units:
            share = Decimal(str(unit["area_m2"])) / total_area
            charge = (amount * share).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if charge <= 0:
                continue

            existing = self.db.execute(
                """
                SELECT * FROM ledger
                WHERE unit_id = %s AND month = %s AND line_type = 'common_expense'
                """,
                (unit["id"], month.isoformat()),
            ).fetchone()

            if existing:
                existing = serialize_row(existing)
                new_due = Decimal(str(existing["amount_due"])) + charge
                amount_paid = Decimal(str(existing["amount_paid"]))
                status = compute_status(new_due, amount_paid, due)
                row = self.db.execute(
                    """
                    UPDATE ledger
                    SET amount_due = %s, status = %s, due_date = %s
                    WHERE id = %s
                    RETURNING *
                    """,
                    (float(new_due), status, due.isoformat(), existing["id"]),
                ).fetchone()
                ledger = serialize_row(row) if row else existing
            else:
                ref = build_reference(building["id"], unit["id"], month)
                row = self.db.execute(
                    """
                    INSERT INTO ledger (
                        unit_id, building_id, month, line_type, amount_due,
                        amount_paid, due_date, payment_reference, status
                    )
                    VALUES (%s, %s, %s, 'common_expense', %s, 0, %s, %s, 'pending')
                    RETURNING *
                    """,
                    (
                        unit["id"],
                        building["id"],
                        month.isoformat(),
                        float(charge),
                        due.isoformat(),
                        ref,
                    ),
                ).fetchone()
                ledger = serialize_row(row)

            month_label = month.strftime("%m/%Y")
            ref = ledger.get("payment_reference") or build_reference(
                building["id"], unit["id"], month
            )

            locale = unit.get("preferred_locale") or "el"
            charge_ctx = build_charge_context(
                amount=format_amount(charge),
                month=month_label,
                reference=ref,
                iban=building.get("virtual_iban") or "",
                locale=locale,
            )
            charge_ctx["subject"] = f"Εισφορά {month_label} — {building.get('name', '')}"

            self.notifications.notify_unit(
                unit,
                template_key="charge_notice",
                context=charge_ctx,
                channels=["sms", "email"],
                ledger_id=ledger["id"],
            )
            updated.append({"unit_id": unit["id"], "charge": float(charge), "ledger_id": ledger["id"]})

        return {"expense_id": expense_id, "units_updated": len(updated), "details": updated}
