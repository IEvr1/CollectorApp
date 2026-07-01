import base64
import io
from decimal import Decimal

import psycopg
import qrcode

from app.db import serialize_row
from app.services.dates import first_of_month
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
    def __init__(self, db: psycopg.Connection):
        self.db = db

    def get_payment_qr(self, unit_id: str, month: str | None = None) -> dict:
        row = self.db.execute(
            """
            SELECT u.*, b.id AS b_id, b.name AS b_name, b.virtual_iban AS b_virtual_iban
            FROM units u
            JOIN buildings b ON b.id = u.building_id
            WHERE u.id = %s
            """,
            (unit_id,),
        ).fetchone()
        if not row:
            raise ValueError("Unit not found")

        unit = serialize_row(row)
        building = {
            "id": unit.pop("b_id"),
            "name": unit.pop("b_name"),
            "virtual_iban": unit.pop("b_virtual_iban"),
        }

        m = first_of_month()
        if month:
            from datetime import date

            m = date.fromisoformat(month + "-01") if len(month) == 7 else date.fromisoformat(month)

        ref = build_reference(unit["building_id"], unit["id"], m)

        ledger = self.db.execute(
            """
            SELECT amount_due, amount_paid, balance FROM ledger
            WHERE unit_id = %s AND month = %s AND line_type = 'common_expense'
            """,
            (unit_id, m.isoformat()),
        ).fetchone()

        balance = Decimal("0")
        if ledger:
            balance = Decimal(str(ledger.get("balance") or 0))

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
