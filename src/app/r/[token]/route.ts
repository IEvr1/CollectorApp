import { NextResponse } from "next/server";
import { verifyDeepLinkToken } from "@/lib/deep-link-token";
import { MANAGE_SESSION_COOKIE, signManageSessionCookieValue } from "@/lib/manage-session";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  try {
    const { token } = await params;
    const decoded = await verifyDeepLinkToken(token);

    const session = signManageSessionCookieValue({
      salonId: decoded.salonId,
      phoneE164: decoded.phoneE164,
      bookingId: decoded.bookingId,
    });

    const url = new URL("/chat", base);
    url.searchParams.set("fromLink", "1");

    const res = NextResponse.redirect(url);
    res.cookies.set(MANAGE_SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60,
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/chat?link=expired", base));
  }
}
