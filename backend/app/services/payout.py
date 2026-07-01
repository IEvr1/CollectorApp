from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings
from app.db import serialize_row
from app.services.revolut_business import RevolutBusinessClient, RevolutBusinessError


class PayoutService:
    def __init__(self, db: psycopg.Connection):
        self.db = db
        self.revolut = RevolutBusinessClient()

    def _tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(settings.payout_timezone)
        except Exception:
            return ZoneInfo("Asia/Nicosia")

    def is_payout_day(self, *, when: datetime | None = None, force: bool = False) -> bool:
        if force:
            return True
        now = when or datetime.now(self._tz())
        return now.weekday() == 4  # Friday

    def scheduled_for_date(self, *, when: datetime | None = None) -> date:
        now = when or datetime.now(self._tz())
        return now.date()

    def _pending_payments(self, building_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            """
            SELECT id, amount, ledger_id, received_at, collected_at
            FROM payments
            WHERE building_id = %s AND matched = true AND paid_out_at IS NULL
            ORDER BY received_at
            """,
            (building_id,),
        ).fetchall()
        return [serialize_row(r) for r in rows]

    def pending_amount(self, building_id: str) -> Decimal:
        payments = self._pending_payments(building_id)
        return sum(Decimal(str(p["amount"])) for p in payments)

    def _existing_batch(self, building_id: str, scheduled_for: date) -> dict | None:
        row = self.db.execute(
            """
            SELECT * FROM payout_batches
            WHERE building_id = %s AND scheduled_for = %s
            """,
            (building_id, scheduled_for.isoformat()),
        ).fetchone()
        return serialize_row(row) if row else None

    def _week_reference(self, scheduled_for: date, building_id: str) -> str:
        year, week, _ = scheduled_for.isocalendar()
        return f"PAYOUT-{building_id[:8]}-{year}-W{week:02d}"

    def _mark_payments_paid_out(
        self,
        *,
        payment_ids: list[str],
        batch_id: str,
        paid_out_at: str,
    ) -> None:
        if not payment_ids:
            return

        self.db.execute(
            """
            UPDATE payments
            SET paid_out_at = %s, payout_batch_id = %s
            WHERE id = ANY(%s)
            """,
            (paid_out_at, batch_id, payment_ids),
        )

    def _sync_ledger_payout_status(self, ledger_ids: set[str], batch_id: str, paid_out_at: str) -> None:
        for ledger_id in ledger_ids:
            if not ledger_id:
                continue

            ledger = self.db.execute(
                "SELECT id, amount_paid FROM ledger WHERE id = %s",
                (ledger_id,),
            ).fetchone()
            if not ledger:
                continue

            payments = self.db.execute(
                """
                SELECT id, amount, paid_out_at, matched
                FROM payments
                WHERE ledger_id = %s AND matched = true
                """,
                (ledger_id,),
            ).fetchall()

            if not payments:
                continue

            if any(p.get("paid_out_at") is None for p in payments):
                continue

            paid_out_total = sum(Decimal(str(p["amount"])) for p in payments)
            amount_paid = Decimal(str(ledger["amount_paid"]))
            if paid_out_total + Decimal("0.01") >= amount_paid:
                self.db.execute(
                    """
                    UPDATE ledger
                    SET paid_out_at = %s, payout_batch_id = %s
                    WHERE id = %s
                    """,
                    (paid_out_at, batch_id, ledger_id),
                )

    def run_building_payout(
        self,
        building: dict[str, Any],
        *,
        scheduled_for: date,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        building_id = building["id"]
        existing = self._existing_batch(building_id, scheduled_for)
        if existing and existing["status"] in ("completed", "processing"):
            return {
                "building_id": building_id,
                "status": "skipped",
                "reason": "batch_exists",
                "batch_id": existing["id"],
            }

        if not building.get("payout_enabled"):
            return {"building_id": building_id, "status": "skipped", "reason": "payout_disabled"}

        counterparty_id = building.get("revolut_counterparty_id")
        counterparty_account_id = building.get("revolut_counterparty_account_id")
        if not counterparty_id or not counterparty_account_id:
            return {
                "building_id": building_id,
                "status": "skipped",
                "reason": "missing_counterparty",
            }

        payments = self._pending_payments(building_id)
        total = sum(Decimal(str(p["amount"])) for p in payments)
        min_amount = settings.payout_min_amount

        if total < min_amount:
            return {
                "building_id": building_id,
                "status": "skipped",
                "reason": "below_minimum",
                "pending_amount": float(total),
                "minimum": float(min_amount),
            }

        reference = self._week_reference(scheduled_for, building_id)
        payment_ids = [p["id"] for p in payments]
        ledger_ids = {p["ledger_id"] for p in payments if p.get("ledger_id")}

        if dry_run:
            return {
                "building_id": building_id,
                "status": "dry_run",
                "total_amount": float(total),
                "payment_count": len(payments),
                "reference": reference,
            }

        batch_id = str(uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        self.db.execute(
            """
            INSERT INTO payout_batches (
                id, building_id, scheduled_for, status, total_amount,
                payment_count, reference, revolut_request_id
            )
            VALUES (%s, %s, %s, 'processing', %s, %s, %s, %s)
            ON CONFLICT (building_id, scheduled_for) DO UPDATE SET
                status = EXCLUDED.status,
                total_amount = EXCLUDED.total_amount,
                payment_count = EXCLUDED.payment_count,
                reference = EXCLUDED.reference,
                revolut_request_id = EXCLUDED.revolut_request_id
            """,
            (
                batch_id,
                building_id,
                scheduled_for.isoformat(),
                float(total),
                len(payments),
                reference,
                batch_id,
            ),
        )

        source_account_id = settings.revolut_source_account_id
        if not source_account_id:
            self.db.execute(
                """
                UPDATE payout_batches
                SET status = 'failed',
                    error_message = 'REVOLUT_SOURCE_ACCOUNT_ID not configured',
                    completed_at = %s
                WHERE id = %s
                """,
                (now_iso, batch_id),
            )
            return {
                "building_id": building_id,
                "status": "failed",
                "reason": "missing_source_account",
                "batch_id": batch_id,
            }

        if not self.revolut.configured:
            self.db.execute(
                """
                UPDATE payout_batches
                SET status = 'failed',
                    error_message = 'REVOLUT_API_KEY not configured',
                    completed_at = %s
                WHERE id = %s
                """,
                (now_iso, batch_id),
            )
            return {
                "building_id": building_id,
                "status": "failed",
                "reason": "revolut_not_configured",
                "batch_id": batch_id,
            }

        try:
            transfer = self.revolut.create_payment(
                request_id=UUID(batch_id),
                account_id=source_account_id,
                counterparty_id=counterparty_id,
                counterparty_account_id=counterparty_account_id,
                amount=total,
                reference=reference,
            )
        except RevolutBusinessError as exc:
            self.db.execute(
                """
                UPDATE payout_batches
                SET status = 'failed', error_message = %s, completed_at = %s
                WHERE id = %s
                """,
                (str(exc)[:500], now_iso, batch_id),
            )
            return {
                "building_id": building_id,
                "status": "failed",
                "reason": "revolut_error",
                "error": str(exc),
                "batch_id": batch_id,
            }

        tx_id = transfer.get("id") or transfer.get("transaction_id")
        self._mark_payments_paid_out(
            payment_ids=payment_ids,
            batch_id=batch_id,
            paid_out_at=now_iso,
        )
        self._sync_ledger_payout_status(ledger_ids, batch_id, now_iso)

        self.db.execute(
            """
            UPDATE payout_batches
            SET status = 'completed', revolut_transaction_id = %s, completed_at = %s
            WHERE id = %s
            """,
            (tx_id, now_iso, batch_id),
        )

        return {
            "building_id": building_id,
            "status": "completed",
            "batch_id": batch_id,
            "total_amount": float(total),
            "payment_count": len(payments),
            "reference": reference,
            "revolut_transaction_id": tx_id,
        }

    def run_weekly_friday(
        self,
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        now = datetime.now(self._tz())
        scheduled_for = self.scheduled_for_date(when=now)

        if not self.is_payout_day(when=now, force=force):
            return {
                "status": "skipped",
                "reason": "not_friday",
                "scheduled_for": scheduled_for.isoformat(),
                "timezone": settings.payout_timezone,
            }

        rows = self.db.execute(
            """
            SELECT id, name, payout_enabled, revolut_counterparty_id,
                   revolut_counterparty_account_id, payout_iban
            FROM buildings
            WHERE payout_enabled = true
            """
        ).fetchall()
        buildings = [serialize_row(r) for r in rows]

        results = [
            self.run_building_payout(building, scheduled_for=scheduled_for, dry_run=dry_run)
            for building in buildings
        ]

        completed = sum(1 for r in results if r.get("status") == "completed")
        skipped = sum(1 for r in results if r.get("status") == "skipped")
        failed = sum(1 for r in results if r.get("status") == "failed")

        return {
            "status": "ok",
            "scheduled_for": scheduled_for.isoformat(),
            "timezone": settings.payout_timezone,
            "buildings_processed": len(results),
            "completed": completed,
            "skipped": skipped,
            "failed": failed,
            "results": results,
            "dry_run": dry_run,
        }
