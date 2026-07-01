from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


GroupType = Literal["building", "school", "association", "other"]
SplitMethod = Literal["by_area", "equal", "custom_weight"]
ExpenseCategory = Literal[
    "maintenance", "utilities", "dues", "event", "insurance", "other"
]


class BuildingCreate(BaseModel):
    name: str
    address: str | None = None
    virtual_iban: str | None = None
    group_type: GroupType = "building"
    split_method: SplitMethod = "by_area"
    payout_enabled: bool = False
    payout_iban: str | None = None
    payout_recipient_name: str | None = None


class BuildingResponse(BaseModel):
    id: UUID
    name: str
    address: str | None = None
    virtual_iban: str | None = None
    group_type: GroupType = "building"
    split_method: SplitMethod = "by_area"
    total_area_m2: Decimal | None = None
    created_at: datetime | None = None
    payout_enabled: bool = False
    revolut_counterparty_id: str | None = None
    revolut_counterparty_account_id: str | None = None
    payout_iban: str | None = None
    payout_recipient_name: str | None = None


class BuildingPayoutConfigUpdate(BaseModel):
    payout_enabled: bool | None = None
    revolut_counterparty_id: str | None = None
    revolut_counterparty_account_id: str | None = None
    payout_iban: str | None = None
    payout_recipient_name: str | None = None


class PayoutBatchResponse(BaseModel):
    id: UUID
    building_id: UUID
    scheduled_for: date
    status: str
    total_amount: Decimal
    payment_count: int
    reference: str | None = None
    revolut_transaction_id: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


class BuildingPayoutSummary(BaseModel):
    pending_amount: Decimal
    minimum_payout: Decimal
    payout_enabled: bool
    next_payout_label: str = "Friday"
    last_payout: PayoutBatchResponse | None = None


class UnitCreate(BaseModel):
    unit_number: str
    owner_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    area_m2: Decimal | None = None
    weight: Decimal = Field(default=Decimal("1"), gt=0)
    floor: int | None = None
    preferred_locale: Literal["el", "en"] = "el"

    @model_validator(mode="after")
    def validate_area_for_building_groups(self) -> "UnitCreate":
        if self.area_m2 is not None and self.area_m2 <= 0:
            raise ValueError("area_m2 must be positive when provided")
        return self


class UnitResponse(BaseModel):
    id: UUID
    building_id: UUID
    unit_number: str
    owner_name: str | None = None
    email: str | None = None
    phone: str | None = None
    area_m2: Decimal | None = None
    weight: Decimal | None = Decimal("1")
    share_percentage: Decimal | None = None
    floor: int | None = None
    preferred_locale: str | None = "el"


class ExpenseCreate(BaseModel):
    date: date
    category: ExpenseCategory
    vendor: str | None = None
    amount: Decimal = Field(gt=0)


class ExpenseResponse(BaseModel):
    id: UUID
    building_id: UUID
    date: date
    category: str
    vendor: str | None = None
    amount: Decimal
    approved: bool = True


class LedgerEntry(BaseModel):
    id: UUID
    unit_id: UUID
    building_id: UUID
    month: date
    line_type: str
    amount_due: Decimal
    amount_paid: Decimal
    balance: Decimal | None = None
    due_date: date | None = None
    status: str
    payment_reference: str | None = None
    collected_at: datetime | None = None
    paid_out_at: datetime | None = None
    payout_batch_id: UUID | None = None


class BuildingDashboard(BaseModel):
    building: BuildingResponse
    collected_this_month: Decimal
    outstanding: Decimal
    pending_payout: Decimal = Decimal("0")
    payout_enabled: bool = False
    next_payout_label: str = "Friday"
    last_payout_amount: Decimal | None = None
    last_payout_date: date | None = None
    units_paid: int
    units_total: int
    units: list[dict]


class NotificationSend(BaseModel):
    unit_id: UUID
    template_key: str = "charge_notice"
    channels: list[Literal["sms", "email"]] = ["sms", "email"]


class PayoutRunResponse(BaseModel):
    status: str
    dry_run: bool = False
    total_amount: float | None = None
    payment_count: int | None = None
    reference: str | None = None
    batch_id: str | None = None
    reason: str | None = None
    error: str | None = None
