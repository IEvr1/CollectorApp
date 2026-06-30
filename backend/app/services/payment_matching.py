from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from supabase import Client

from app.services.expense_distribution import compute_status
from app.services.notifications import NotificationService, format_amount
from app.services.payment_reference import month_from_yyyymm, parse_reference


PaymentMethod = Literal["bank_transfer", "payment_link"]


class PaymentMatchingService:
    def __init__(self, db: Client):
        self.db = db
        self.notifications = NotificationService(db)

    def _find_duplicate(self, external_id: str, merchant_order_id: str | None) -> dict | None:
        q = self.db.table("payments").select("id")
        if merchant_order_id and merchant_order_id != external_id:
            r = (
                q.or_(
                    f"revolut_transaction_id.eq.{external_id},"
                    f"revolut_transaction_id.eq.{merchant_order_id},"
                    f"merchant_order_id.eq.{merchant_order_id}"
                )
                .maybe_single()
                .execute()
            )
        else:
            r = q.eq("revolut_transaction_id", external_id).maybe_single().execute()
        return r.data

    def process_payment(
        self,
        *,
        amount: Decimal,
        reference: str,
        external_id: str,
        payment_method: PaymentMethod = "bank_transfer",
        virtual_iban: str | None = None,
        merchant_order_id: str | None = None,
    ) -> dict:
        merchant_order_id = merchant_order_id or (
            external_id if payment_method == "payment_link" else None
        )

        existing = self._find_duplicate(external_id, merchant_order_id)
        if existing:
            return {"status": "duplicate", "payment_id": existing["id"]}

        parsed = parse_reference(reference)
        if not parsed:
            payment = (
                self.db.table("payments")
                .insert(
                    {
                        "amount": float(amount),
                        "payment_reference": reference,
                        "revolut_transaction_id": external_id,
                        "merchant_order_id": merchant_order_id,
                        "payment_method": payment_method,
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
            ledger_update: dict = {
                "amount_paid": float(amount_paid),
                "status": status,
                "payment_date": paid_at if status == "paid" else ledger.data.get("payment_date"),
                "payment_reference": reference,
            }
            if not ledger.data.get("collected_at"):
                ledger_update["collected_at"] = paid_at

            self.db.table("ledger").update(ledger_update).eq("id", ledger.data["id"]).execute()
            ledger_id = ledger.data["id"]
        else:
            ledger_id = None

        collected_at = datetime.now(timezone.utc).isoformat() if ledger_id else None
        payment = (
            self.db.table("payments")
            .insert(
                {
                    "building_id": building_id,
                    "unit_id": unit_id,
                    "ledger_id": ledger_id,
                    "amount": float(amount),
                    "payment_reference": reference,
                    "revolut_transaction_id": external_id,
                    "merchant_order_id": merchant_order_id,
                    "payment_method": payment_method,
                    "matched": ledger_id is not None,
                    "collected_at": collected_at,
                }
            )
            .execute()
        ).data[0]

        if payment_method == "payment_link" and merchant_order_id:
            from app.services.payment_link import PaymentLinkService

            PaymentLinkService(self.db).mark_link_completed(merchant_order_id, "completed")

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
