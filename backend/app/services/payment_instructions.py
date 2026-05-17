def payment_link_line(payment_link: str | None, locale: str = "el") -> str:
    if not payment_link:
        return ""
    if locale == "en":
        return f"Pay online: {payment_link}"
    return f"Πληρωμή online: {payment_link}"


def build_charge_context(
    *,
    amount: str,
    month: str,
    reference: str,
    iban: str,
    payment_link: str | None,
    locale: str,
) -> dict:
    return {
        "amount": amount,
        "month": month,
        "reference": reference,
        "iban": iban or "—",
        "payment_link": payment_link or "",
        "payment_link_line": payment_link_line(payment_link, locale),
    }
