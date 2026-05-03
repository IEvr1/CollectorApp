import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
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

export function proxy(request: NextRequest) {
  const secret = process.env.DASHBOARD_AUTH_SECRET?.trim();
  if (!secret) {
    return NextResponse.next();
  }

  const expectedUser = process.env.DASHBOARD_AUTH_USER?.trim() || "admin";
  const parsed = parseBasicAuth(request.headers.get("authorization"));
  if (!parsed || parsed.user !== expectedUser || parsed.pass !== secret) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Salon dashboard"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
