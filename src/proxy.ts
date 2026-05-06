import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isDashboardPageAuthorized } from "@/lib/dashboard-auth";

/** Next.js 16 entry: dashboard Basic auth when `DASHBOARD_AUTH_SECRET` is set. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  if (!isDashboardPageAuthorized(request)) {
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
