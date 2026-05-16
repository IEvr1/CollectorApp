import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export function getAccessToken(): string | null {
  const raw = localStorage.getItem("sb-session");
  if (!raw) return null;
  try {
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

export function setSession(accessToken: string, refreshToken: string) {
  localStorage.setItem(
    "sb-session",
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
  );
}

export function clearSession() {
  localStorage.removeItem("sb-session");
}
