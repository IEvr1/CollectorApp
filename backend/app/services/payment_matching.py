from datetime import datetime, timezone
from decimal import Decimal

from supabase import Client

from app.services.expense_distribution import compute_status
from app.services.notifications import NotificationService, format_amount
from app.services.payment_reference import month_from_yyyymm, parse_reference


class PaymentMatchingService:
    def __init__(self, db: Client):
        self.db = db
        self.notifications = NotificationService(db)

    def process_payment(
        self,
        *,
        amount: Decimal,
        virtual_iban: str | None,
        reference: str,
        revolut_transaction_id: str,
    ) -> dict:
        existing = (
            self.db.table("payments")
            .select("id")
            .eq("revolut_transaction_id", revolut_transaction_id)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return {"status": "duplicate", "payment_id": existing.data["id"]}

        parsed = parse_reference(reference)
        if not parsed:
            payment = (
                self.db.table("payments")
                .insert(
                    {
                        "amount": float(amount),
                        "payment_reference": reference,
                        "revolut_transaction_id": revolut_transaction_id,
                        "matched": False,
                    }
                )
                .execute()
            )
            return {"status": "unmatched", "payment_id": payment.data[0]["id"] if payment.data else None}

        building_id, unit_id, yyyymm = parsed
        month = month_from_yyyymm(yyyymm).isoformat()

        if virtual_iban:
            b = (
                self.db.table("buildings")
                .select("id")
                .eq("virtual_iban", virtual_iban)
                .maybe_single()
                .execute()
            )
            if b.data and b.data["id"] != building_id:
                raise ValueError("IBAN does not match building in reference")

        ledger = (
            self.db.table("ledger")
            .select("*, units(*)")
            .eq("unit_id", unit_id)
            .eq("month", month)
            .eq("line_type", "common_expense")
            .maybe_single()
            .execute()
        )

        unit = None
        if ledger.data:
            unit = ledger.data.get("units") or (
                self.db.table("units").select("*").eq("id", unit_id).single().execute()
            ).data
            amount_due = Decimal(str(ledger.data["amount_due"]))
            amount_paid = Decimal(str(ledger.data["amount_paid"])) + amount
            due_date = ledger.data.get("due_date")
            if due_date and isinstance(due_date, str):
                from datetime import date

                due_date = date.fromisoformat(due_date)
            status = compute_status(amount_due, amount_paid, due_date)
            paid_at = datetime.now(timezone.utc).isoformat()

            self.db.table("ledger").update(
                {
                    "amount_paid": float(amount_paid),
                    "status": status,
                    "payment_date": paid_at if status == "paid" else ledger.data.get("payment_date"),
                    "payment_reference": reference,
                }
            ).eq("id", ledger.data["id"]).execute()
            ledger_id = ledger.data["id"]
        else:
            ledger_id = None

        payment = (
            self.db.table("payments")
            .insert(
                {
                    "building_id": building_id,
                    "unit_id": unit_id,
                    "ledger_id": ledger_id,
                    "amount": float(amount),
                    "payment_reference": reference,
                    "revolut_transaction_id": revolut_transaction_id,
                    "matched": ledger_id is not None,
                }
            )
            .execute()
        ).data[0]

        if unit and ledger.data:
            building = (
                self.db.table("buildings").select("name").eq("id", building_id).single().execute()
            ).data
            self.notifications.notify_unit(
                unit,
                template_key="payment_receipt",
                context={
                    "amount": format_amount(amount),
                    "month": month_from_yyyymm(yyyymm).strftime("%m/%Y"),
                    "reference": reference,
                    "subject": f"Επιβεβαίωση πληρωμής — {building.get('name', '')}",
                },
                channels=["sms", "email"],
                ledger_id=ledger_id,
            )

        return {
            "status": "matched" if ledger_id else "unmatched",
            "payment_id": payment["id"],
            "ledger_id": ledger_id,
        }
