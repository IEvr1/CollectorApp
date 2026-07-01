from datetime import datetime, timezone
from decimal import Decimal

import psycopg

from app.db import serialize_row
from app.services.expense_distribution import compute_status
from app.services.notifications import NotificationService, format_amount
from app.services.payment_reference import month_from_yyyymm, parse_reference


class PaymentMatchingService:
    def __init__(self, db: psycopg.Connection):
        self.db = db
        self.notifications = NotificationService(db)

    def _find_duplicate(self, external_id: str) -> dict | None:
        row = self.db.execute(
            "SELECT id FROM payments WHERE revolut_transaction_id = %s",
            (external_id,),
        ).fetchone()
        return serialize_row(row) if row else None

    def process_payment(
        self,
        *,
        amount: Decimal,
        reference: str,
        external_id: str,
        virtual_iban: str | None = None,
    ) -> dict:
        existing = self._find_duplicate(external_id)
        if existing:
            return {"status": "duplicate", "payment_id": existing["id"]}

        parsed = parse_reference(reference)
        if not parsed:
            row = self.db.execute(
                """
                INSERT INTO payments (
                    amount, payment_reference, revolut_transaction_id,
                    payment_method, matched
                )
                VALUES (%s, %s, %s, 'bank_transfer', false)
                RETURNING id
                """,
                (float(amount), reference, external_id),
            ).fetchone()
            return {"status": "unmatched", "payment_id": serialize_row(row)["id"] if row else None}

        building_id, unit_id, yyyymm = parsed
        month = month_from_yyyymm(yyyymm).isoformat()

        if virtual_iban:
            b = self.db.execute(
                "SELECT id FROM buildings WHERE virtual_iban = %s",
                (virtual_iban,),
            ).fetchone()
            if b and str(b["id"]) != building_id:
                raise ValueError("IBAN does not match building in reference")

        ledger_row = self.db.execute(
            """
            SELECT l.*, row_to_json(u) AS unit_data
            FROM ledger l
            JOIN units u ON u.id = l.unit_id
            WHERE l.unit_id = %s AND l.month = %s AND l.line_type = 'common_expense'
            """,
            (unit_id, month),
        ).fetchone()

        unit = None
        ledger_data = None
        ledger_id = None

        if ledger_row:
            ledger_data = serialize_row({k: v for k, v in ledger_row.items() if k != "unit_data"})
            unit = serialize_row(ledger_row["unit_data"]) if ledger_row.get("unit_data") else None

            amount_due = Decimal(str(ledger_data["amount_due"]))
            amount_paid = Decimal(str(ledger_data["amount_paid"])) + amount
            due_date = ledger_data.get("due_date")
            if due_date and isinstance(due_date, str):
                from datetime import date

                due_date = date.fromisoformat(due_date)
            status = compute_status(amount_due, amount_paid, due_date)
            paid_at = datetime.now(timezone.utc).isoformat()
            ledger_update = {
                "amount_paid": float(amount_paid),
                "status": status,
                "payment_date": paid_at if status == "paid" else ledger_data.get("payment_date"),
                "payment_reference": reference,
            }
            if not ledger_data.get("collected_at"):
                ledger_update["collected_at"] = paid_at

            self.db.execute(
                """
                UPDATE ledger
                SET amount_paid = %s, status = %s, payment_date = %s,
                    payment_reference = %s, collected_at = COALESCE(collected_at, %s)
                WHERE id = %s
                """,
                (
                    ledger_update["amount_paid"],
                    ledger_update["status"],
                    ledger_update["payment_date"],
                    ledger_update["payment_reference"],
                    ledger_update.get("collected_at"),
                    ledger_data["id"],
                ),
            )
            ledger_id = ledger_data["id"]
        else:
            unit_row = self.db.execute(
                "SELECT * FROM units WHERE id = %s",
                (unit_id,),
            ).fetchone()
            unit = serialize_row(unit_row) if unit_row else None

        collected_at = datetime.now(timezone.utc).isoformat() if ledger_id else None
        payment_row = self.db.execute(
            """
            INSERT INTO payments (
                building_id, unit_id, ledger_id, amount, payment_reference,
                revolut_transaction_id, payment_method, matched, collected_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, 'bank_transfer', %s, %s)
            RETURNING *
            """,
            (
                building_id,
                unit_id,
                ledger_id,
                float(amount),
                reference,
                external_id,
                ledger_id is not None,
                collected_at,
            ),
        ).fetchone()
        payment = serialize_row(payment_row)

        if unit and ledger_data:
            building = self.db.execute(
                "SELECT name FROM buildings WHERE id = %s",
                (building_id,),
            ).fetchone()
            building_name = building["name"] if building else ""
            self.notifications.notify_unit(
                unit,
                template_key="payment_receipt",
                context={
                    "amount": format_amount(amount),
                    "month": month_from_yyyymm(yyyymm).strftime("%m/%Y"),
                    "reference": reference,
                    "subject": f"Επιβεβαίωση πληρωμής — {building_name}",
                },
                channels=["sms", "email"],
                ledger_id=ledger_id,
            )

        return {
            "status": "matched" if ledger_id else "unmatched",
            "payment_id": payment["id"],
            "ledger_id": ledger_id,
        }
