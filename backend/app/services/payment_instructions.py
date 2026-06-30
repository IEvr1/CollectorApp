def build_charge_context(
    *,
    amount: str,
    month: str,
    reference: str,
    iban: str,
    locale: str,
) -> dict:
    return {
        "amount": amount,
        "month": month,
        "reference": reference,
        "iban": iban or "—",
    }
