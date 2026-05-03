import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) {
    return null;
  }
  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(":");
    if (colon === -1) {
      return null;
    }
    return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Dashboard is not configured (set DASHBOARD_AUTH_SECRET)." },
      { status: 503 },
    );
  }

  const expectedUser = process.env.DASHBOARD_AUTH_USER ?? "manager";
  const creds = parseBasicAuth(request.headers.get("authorization"));
  if (!creds || creds.user !== expectedUser || creds.password !== secret) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Dashboard"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
