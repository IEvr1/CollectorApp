import { getAccessToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export interface Building {
  id: string;
  name: string;
  address?: string;
  virtual_iban?: string;
  total_area_m2?: number;
}

export interface BuildingDashboard {
  building: Building;
  collected_this_month: number;
  outstanding: number;
  units_paid: number;
  units_total: number;
  units: UnitWithLedger[];
}

export interface UnitWithLedger {
  id: string;
  unit_number: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  area_m2: number;
  balance: number;
  status: string;
  ledger?: { amount_due: number; amount_paid: number; payment_reference?: string };
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  vendor?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
