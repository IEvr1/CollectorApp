from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from supabase import Client

from app.services.notifications import NotificationService, format_amount
from app.services.payment_instructions import build_charge_context
from app.services.payment_link import PaymentLinkService
from app.services.payment_reference import build_reference
from app.services.revolut_merchant import RevolutMerchantError


from app.services.dates import first_of_month


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
    def __init__(self, db: Client):
        self.db = db
        self.notifications = NotificationService(db)

    def distribute(self, expense_id: str) -> dict:
        expense = (
            self.db.table("expenses").select("*").eq("id", expense_id).single().execute()
        ).data
        if not expense or not expense.get("approved", True):
            raise ValueError("Expense not found or not approved")

        building = (
            self.db.table("buildings").select("*").eq("id", expense["building_id"]).single().execute()
        ).data
        units = (
            self.db.table("units").select("*").eq("building_id", expense["building_id"]).execute()
        ).data or []

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

            existing = (
                self.db.table("ledger")
                .select("*")
                .eq("unit_id", unit["id"])
                .eq("month", month.isoformat())
                .eq("line_type", "common_expense")
                .maybe_single()
                .execute()
            )

            if existing.data:
                new_due = Decimal(str(existing.data["amount_due"])) + charge
                amount_paid = Decimal(str(existing.data["amount_paid"]))
                status = compute_status(new_due, amount_paid, due)
                row = (
                    self.db.table("ledger")
                    .update(
                        {
                            "amount_due": float(new_due),
                            "status": status,
                            "due_date": due.isoformat(),
                        }
                    )
                    .eq("id", existing.data["id"])
                    .execute()
                )
                ledger = row.data[0] if row.data else existing.data
            else:
                ref = build_reference(building["id"], unit["id"], month)
                row = (
                    self.db.table("ledger")
                    .insert(
                        {
                            "unit_id": unit["id"],
                            "building_id": building["id"],
                            "month": month.isoformat(),
                            "line_type": "common_expense",
                            "amount_due": float(charge),
                            "amount_paid": 0,
                            "due_date": due.isoformat(),
                            "payment_reference": ref,
                            "status": "pending",
                        }
                    )
                    .execute()
                )
                ledger = row.data[0]

            month_label = month.strftime("%m/%Y")
            ref = ledger.get("payment_reference") or build_reference(
                building["id"], unit["id"], month
            )
            payment_link: str | None = None
            link_svc = PaymentLinkService(self.db)
            if link_svc.merchant.configured:
                try:
                    link_data = link_svc.create_for_unit_sync(unit["id"], month.isoformat())
                    payment_link = link_data.get("checkout_url")
                except (RevolutMerchantError, ValueError):
                    payment_link = None

            locale = unit.get("preferred_locale") or "el"
            charge_ctx = build_charge_context(
                amount=format_amount(charge),
                month=month_label,
                reference=ref,
                iban=building.get("virtual_iban") or "",
                payment_link=payment_link,
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
