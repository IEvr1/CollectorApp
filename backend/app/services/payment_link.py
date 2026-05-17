from datetime import date
from decimal import Decimal
from typing import Literal

from supabase import Client

from app.config import settings
from app.services.dates import first_of_month
from app.services.payment_reference import build_reference
from app.services.revolut_merchant import RevolutMerchantClient, RevolutMerchantError


class PaymentLinkService:
    def __init__(self, db: Client):
        self.db = db
        self.merchant = RevolutMerchantClient()

    def _resolve_month(self, month: str | None) -> date:
        if not month:
            return first_of_month()
        if len(month) == 7:
            return date.fromisoformat(f"{month}-01")
        return date.fromisoformat(month)

    def _ledger_row(self, unit_id: str, month: date) -> dict | None:
        r = (
            self.db.table("ledger")
            .select("id, amount_due, amount_paid, balance, status")
            .eq("unit_id", unit_id)
            .eq("month", month.isoformat())
            .eq("line_type", "common_expense")
            .maybe_single()
            .execute()
        )
        return r.data

    def get_active_link(self, unit_id: str, month: str | None = None) -> dict | None:
        m = self._resolve_month(month)
        r = (
            self.db.table("payment_links")
            .select("*")
            .eq("unit_id", unit_id)
            .eq("month", m.isoformat())
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        return r.data

    def create_for_unit_sync(
        self,
        unit_id: str,
        month: str | None = None,
        *,
        force_new: bool = False,
    ) -> dict:
        if not self.merchant.configured:
            raise RevolutMerchantError(
                "Revolut Merchant API is not configured. Set REVOLUT_MERCHANT_API_KEY in .env"
            )

        unit = self.db.table("units").select("*, buildings(*)").eq("id", unit_id).single().execute().data
        if not unit:
            raise ValueError("Unit not found")

        m = self._resolve_month(month)
        ledger = self._ledger_row(unit_id, m)
        balance = Decimal(str(ledger.get("balance") or 0)) if ledger else Decimal("0")
        if balance <= 0:
            raise ValueError("No outstanding balance for this month")

        if not force_new:
            existing = self.get_active_link(unit_id, m.isoformat())
            if existing:
                return {
                    "checkout_url": existing["checkout_url"],
                    "order_id": existing["revolut_order_id"],
                    "reference": existing["merchant_reference"],
                    "amount": float(existing["amount"]),
                    "currency": existing["currency"],
                    "reused": True,
                }

        building = unit.get("buildings") or {}
        ref = build_reference(unit["building_id"], unit["id"], m)
        month_label = m.strftime("%m/%Y")
        description = (
            f"Common expenses — {building.get('name', '')} — Unit {unit.get('unit_number', '')} — {month_label}"
        )

        order = self.merchant.create_order_sync(
            amount=balance,
            currency="EUR",
            description=description,
            merchant_reference=ref,
            customer_email=unit.get("email"),
        )

        row = (
            self.db.table("payment_links")
            .insert(
                {
                    "unit_id": unit_id,
                    "building_id": unit["building_id"],
                    "ledger_id": ledger["id"] if ledger else None,
                    "month": m.isoformat(),
                    "revolut_order_id": order["id"],
                    "checkout_url": order["checkout_url"],
                    "merchant_reference": ref,
                    "amount": float(balance),
                    "currency": "EUR",
                    "status": "pending",
                }
            )
            .execute()
        ).data[0]

        return {
            "checkout_url": order["checkout_url"],
            "order_id": order["id"],
            "reference": ref,
            "amount": float(balance),
            "currency": "EUR",
            "payment_link_id": row["id"],
            "reused": False,
        }

    async def create_for_unit(
        self,
        unit_id: str,
        month: str | None = None,
        *,
        force_new: bool = False,
    ) -> dict:
        if not self.merchant.configured:
            raise RevolutMerchantError(
                "Revolut Merchant API is not configured. Set REVOLUT_MERCHANT_API_KEY in .env"
            )

        unit = self.db.table("units").select("*, buildings(*)").eq("id", unit_id).single().execute().data
        if not unit:
            raise ValueError("Unit not found")

        m = self._resolve_month(month)
        ledger = self._ledger_row(unit_id, m)
        balance = Decimal(str(ledger.get("balance") or 0)) if ledger else Decimal("0")
        if balance <= 0:
            raise ValueError("No outstanding balance for this month")

        if not force_new:
            existing = self.get_active_link(unit_id, m.isoformat())
            if existing:
                return {
                    "checkout_url": existing["checkout_url"],
                    "order_id": existing["revolut_order_id"],
                    "reference": existing["merchant_reference"],
                    "amount": float(existing["amount"]),
                    "currency": existing["currency"],
                    "reused": True,
                }

        building = unit.get("buildings") or {}
        ref = build_reference(unit["building_id"], unit["id"], m)
        month_label = m.strftime("%m/%Y")
        description = (
            f"Common expenses — {building.get('name', '')} — Unit {unit.get('unit_number', '')} — {month_label}"
        )

        return self.create_for_unit_sync(unit_id, month, force_new=force_new)

    def mark_link_completed(self, order_id: str, status: Literal["completed", "cancelled", "failed"]) -> None:
        from datetime import datetime, timezone

        patch: dict = {"status": status}
        if status == "completed":
            patch["completed_at"] = datetime.now(timezone.utc).isoformat()
        self.db.table("payment_links").update(patch).eq("revolut_order_id", order_id).execute()
