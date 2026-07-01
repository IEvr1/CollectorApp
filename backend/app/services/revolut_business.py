from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx

from app.config import settings


class RevolutBusinessError(Exception):
    pass


class RevolutBusinessClient:
    def __init__(self) -> None:
        self.base_url = settings.revolut_business_base_url.rstrip("/")
        self.api_key = settings.revolut_api_key

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, *, json: dict | None = None) -> dict[str, Any]:
        if not self.configured:
            raise RevolutBusinessError("Revolut Business API key not configured")

        with httpx.Client(timeout=30.0) as client:
            resp = client.request(
                method,
                f"{self.base_url}/api/1.0{path}",
                headers=self._headers(),
                json=json,
            )

        if resp.status_code >= 400:
            raise RevolutBusinessError(
                f"Revolut Business API error {resp.status_code}: {resp.text}"
            )

        if not resp.content:
            return {}
        return resp.json()

    def get_accounts(self) -> list[dict[str, Any]]:
        data = self._request("GET", "/accounts")
        if isinstance(data, list):
            return data
        return data.get("accounts") or []

    def create_payment(
        self,
        *,
        request_id: UUID | str,
        account_id: str,
        counterparty_id: str,
        counterparty_account_id: str,
        amount: Decimal,
        currency: str = "EUR",
        reference: str,
    ) -> dict[str, Any]:
        if amount <= 0:
            raise RevolutBusinessError("Amount must be greater than zero")

        body = {
            "request_id": str(request_id),
            "account_id": account_id,
            "receiver": {
                "counterparty_id": counterparty_id,
                "account_id": counterparty_account_id,
            },
            "amount": float(amount),
            "currency": currency.upper(),
            "reference": reference[:140],
        }
        return self._request("POST", "/pay", json=body)
