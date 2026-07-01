import { getAccessToken } from "./auth";
import type { GroupType, SplitMethod } from "./i18n";

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

export interface Group {
  id: string;
  name: string;
  address?: string;
  virtual_iban?: string;
  group_type?: GroupType;
  split_method?: SplitMethod;
  total_area_m2?: number;
  payout_enabled?: boolean;
  payout_iban?: string;
  payout_recipient_name?: string;
}

export type Building = Group;

export interface GroupDashboard {
  building: Group;
  collected_this_month: number;
  outstanding: number;
  pending_payout: number;
  payout_enabled: boolean;
  next_payout_label: string;
  last_payout_amount?: number | null;
  last_payout_date?: string | null;
  units_paid: number;
  units_total: number;
  units: MemberWithLedger[];
}

export type BuildingDashboard = GroupDashboard;

export interface MemberWithLedger {
  id: string;
  unit_number: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  area_m2?: number | null;
  weight?: number;
  balance: number;
  status: string;
  ledger?: { amount_due: number; amount_paid: number; payment_reference?: string };
}

export type UnitWithLedger = MemberWithLedger;

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  vendor?: string;
}

export interface PaymentRow {
  id: string;
  amount: number;
  received_at: string;
  matched: boolean;
  collected_at?: string | null;
  paid_out_at?: string | null;
  units?: { unit_number: string };
}

export interface PayoutSummary {
  pending_amount: number;
  minimum_payout: number;
  payout_enabled: boolean;
  next_payout_label: string;
  last_payout?: {
    id: string;
    scheduled_for: string;
    status: string;
    total_amount: number;
    payment_count: number;
    completed_at?: string;
  } | null;
}

export interface PayoutBatch {
  id: string;
  scheduled_for: string;
  status: string;
  total_amount: number;
  payment_count: number;
  reference?: string;
  completed_at?: string;
  error_message?: string;
}

export interface PayoutRunResult {
  status: string;
  dry_run?: boolean;
  total_amount?: number;
  payment_count?: number;
  reference?: string;
  reason?: string;
  error?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface GroupCreatePayload {
  name: string;
  address?: string;
  virtual_iban?: string;
  group_type?: GroupType;
  split_method?: SplitMethod;
  payout_enabled?: boolean;
  payout_iban?: string;
  payout_recipient_name?: string;
}
