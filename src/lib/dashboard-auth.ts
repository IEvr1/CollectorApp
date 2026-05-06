import type { NextRequest } from "next/server";

export function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }
  try {
    const raw = atob(header.slice(6).trim());
    const i = raw.indexOf(":");
    if (i === -1) {
      return null;
    }
    return { user: raw.slice(0, i), pass: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

/** When `DASHBOARD_AUTH_SECRET` is unset, dashboard mutations are disabled (fail closed). */
export function isDashboardMutationAuthorized(headers: Headers): boolean {
  const secret = process.env.DASHBOARD_AUTH_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const expectedUser = process.env.DASHBOARD_AUTH_USER?.trim() || "admin";
  const parsed = parseBasicAuth(headers.get("authorization"));
  return Boolean(parsed && parsed.user === expectedUser && parsed.pass === secret);
}

export function isDashboardPageAuthorized(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_AUTH_SECRET?.trim();
  if (!secret) {
    return true;
  }
  const expectedUser = process.env.DASHBOARD_AUTH_USER?.trim() || "admin";
  const parsed = parseBasicAuth(request.headers.get("authorization"));
  return Boolean(parsed && parsed.user === expectedUser && parsed.pass === secret);
}
