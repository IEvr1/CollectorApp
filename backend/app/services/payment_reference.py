import re
from datetime import date
from uuid import UUID

REF_PATTERN = re.compile(
    r"^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-"
    r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-"
    r"(\d{6})$",
    re.IGNORECASE,
)


def build_reference(building_id: UUID | str, unit_id: UUID | str, month: date) -> str:
    yyyymm = month.strftime("%Y%m")
    return f"{building_id}-{unit_id}-{yyyymm}"


def parse_reference(reference: str) -> tuple[str, str, str] | None:
    m = REF_PATTERN.match(reference.strip())
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def month_from_yyyymm(yyyymm: str) -> date:
    return date(int(yyyymm[:4]), int(yyyymm[4:6]), 1)
