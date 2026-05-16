import base64
import io
from decimal import Decimal
from uuid import UUID

import qrcode
from supabase import Client

from app.services.expense_distribution import first_of_month
from app.services.payment_reference import build_reference


def generate_qr_png(data: str) -> bytes:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class QRPaymentService:
    def __init__(self, db: Client):
        self.db = db

    def get_payment_qr(self, unit_id: str, month: str | None = None) -> dict:
        unit = self.db.table("units").select("*, buildings(*)").eq("id", unit_id).single().execute().data
        if not unit:
            raise ValueError("Unit not found")

        building = unit.get("buildings") or {}
        m = first_of_month()
        if month:
            from datetime import date

            m = date.fromisoformat(month + "-01") if len(month) == 7 else date.fromisoformat(month)

        ref = build_reference(unit["building_id"], unit["id"], m)

        ledger = (
            self.db.table("ledger")
            .select("amount_due, amount_paid, balance")
            .eq("unit_id", unit_id)
            .eq("month", m.isoformat())
            .eq("line_type", "common_expense")
            .maybe_single()
            .execute()
        )
        balance = Decimal("0")
        if ledger.data:
            balance = Decimal(str(ledger.data.get("balance") or 0))

        iban = building.get("virtual_iban") or ""
        epc = "\n".join(
            [
                "BCD",
                "002",
                "1",
                "SCT",
                "",
                "",
                iban,
                f"EUR{float(balance):.2f}",
                "",
                "",
                ref[:35],
                f"Unit {unit.get('unit_number', '')}"[:70],
            ]
        )
        png = generate_qr_png(epc)
        b64 = base64.b64encode(png).decode("ascii")

        return {
            "unit_id": unit_id,
            "building_id": unit["building_id"],
            "iban": iban,
            "reference": ref,
            "amount": float(balance),
            "qr_png_base64": b64,
            "payment_instructions": {
                "el": f"IBAN: {iban}\nΠοσό: €{balance:.2f}\nΑναφορά: {ref}",
                "en": f"IBAN: {iban}\nAmount: €{balance:.2f}\nReference: {ref}",
            },
        }
