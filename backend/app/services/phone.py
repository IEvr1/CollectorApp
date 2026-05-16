import re


def normalize_cyprus_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw.strip())
    if digits.startswith("00357"):
        digits = digits[5:]
    elif digits.startswith("357"):
        digits = digits[3:]
    if len(digits) == 8 and digits[0] in "29":
        return f"+357{digits}"
    if raw.strip().startswith("+") and len(digits) >= 10:
        return f"+{digits}" if not raw.strip().startswith("+") else raw.strip()
    return None
