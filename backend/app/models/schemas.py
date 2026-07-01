from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class BuildingCreate(BaseModel):
    name: str
    address: str | None = None
    virtual_iban: str | None = None
    monthly_budget: Decimal = Decimal("0")
    reserve_fund_target: Decimal = Decimal("0")


class BuildingResponse(BaseModel):
    id: UUID
    name: str
    address: str | None = None
    virtual_iban: str | None = None
    total_area_m2: Decimal | None = None
    monthly_budget: Decimal | None = None
    reserve_fund_target: Decimal | None = None
    reserve_fund_current: Decimal | None = None
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
    last_payout: PayoutBatchResponse | None = None


class UnitCreate(BaseModel):
    unit_number: str
    owner_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    area_m2: Decimal = Field(gt=0)
    floor: int | None = None
    preferred_locale: Literal["el", "en"] = "el"


class UnitResponse(BaseModel):
    id: UUID
    building_id: UUID
    unit_number: str
    owner_name: str | None = None
    email: str | None = None
    phone: str | None = None
    area_m2: Decimal
    share_percentage: Decimal | None = None
    floor: int | None = None
    preferred_locale: str | None = "el"


class ExpenseCreate(BaseModel):
    date: date
    category: Literal[
        "electricity", "water", "elevator", "cleaning", "insurance", "reserve", "other"
    ]
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
    extracted_by_ai: bool = False


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
    units_paid: int
    units_total: int
    units: list[dict]


class NotificationSend(BaseModel):
    unit_id: UUID
    template_key: str = "charge_notice"
    channels: list[Literal["sms", "email"]] = ["sms", "email"]
