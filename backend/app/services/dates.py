from datetime import date


def first_of_month(d: date | None = None) -> date:
    d = d or date.today()
    return d.replace(day=1)
