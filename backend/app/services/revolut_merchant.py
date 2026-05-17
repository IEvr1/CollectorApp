from decimal import Decimal
from typing import Any

import httpx

from app.config import settings


class RevolutMerchantError(Exception):
    pass


class RevolutMerchantClient:
    def __init__(self) -> None:
        self.base_url = settings.revolut_merchant_base_url.rstrip("/")
        self.api_key = settings.revolut_merchant_api_key
        self.api_version = settings.revolut_merchant_api_version

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Revolut-Api-Version": self.api_version,
        }

    def create_order_sync(
        self,
        *,
        amount: Decimal,
        currency: str,
        description: str,
        merchant_reference: str,
        customer_email: str | None = None,
        redirect_url: str | None = None,
    ) -> dict[str, Any]:
        if not self.configured:
            raise RevolutMerchantError("Revolut Merchant API key not configured")

        minor = int((amount * 100).quantize(Decimal("1")))
        if minor <= 0:
            raise RevolutMerchantError("Amount must be greater than zero")

        body: dict[str, Any] = {
            "amount": minor,
            "currency": currency.upper(),
            "description": description[:255],
            "merchant_order_data": {"reference": merchant_reference[:255]},
        }
        if customer_email:
            body["customer"] = {"email": customer_email}
        redirect = redirect_url or settings.revolut_payment_redirect_url
        if not redirect and settings.frontend_url:
            redirect = f"{settings.frontend_url.rstrip('/')}/payment/success"
        if redirect:
            body["redirect_url"] = redirect

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                f"{self.base_url}/api/orders",
                headers=self._headers(),
                json=body,
            )

        if resp.status_code >= 400:
            raise RevolutMerchantError(f"Revolut Merchant API error {resp.status_code}: {resp.text}")

        data = resp.json()
        if not data.get("checkout_url") or not data.get("id"):
            raise RevolutMerchantError("Invalid order response from Revolut")
        return data

    async def create_order(
        self,
        *,
        amount: Decimal,
        currency: str,
        description: str,
        merchant_reference: str,
        customer_email: str | None = None,
        redirect_url: str | None = None,
    ) -> dict[str, Any]:
        if not self.configured:
            raise RevolutMerchantError("Revolut Merchant API key not configured")

        minor = int((amount * 100).quantize(Decimal("1")))
        if minor <= 0:
            raise RevolutMerchantError("Amount must be greater than zero")

        body: dict[str, Any] = {
            "amount": minor,
            "currency": currency.upper(),
            "description": description[:255],
            "merchant_order_data": {"reference": merchant_reference[:255]},
        }
        if customer_email:
            body["customer"] = {"email": customer_email}
        redirect = redirect_url or settings.revolut_payment_redirect_url
        if not redirect and settings.frontend_url:
            redirect = f"{settings.frontend_url.rstrip('/')}/payment/success"
        if redirect:
            body["redirect_url"] = redirect

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/orders",
                headers=self._headers(),
                json=body,
            )

        if resp.status_code >= 400:
            raise RevolutMerchantError(f"Revolut Merchant API error {resp.status_code}: {resp.text}")

        data = resp.json()
        if not data.get("checkout_url") or not data.get("id"):
            raise RevolutMerchantError("Invalid order response from Revolut")
        return data

    async def get_order(self, order_id: str) -> dict[str, Any]:
        if not self.configured:
            raise RevolutMerchantError("Revolut Merchant API key not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.base_url}/api/orders/{order_id}",
                headers=self._headers(),
            )

        if resp.status_code >= 400:
            raise RevolutMerchantError(f"Revolut Merchant API error {resp.status_code}: {resp.text}")
        return resp.json()
