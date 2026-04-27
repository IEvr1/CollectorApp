import { NextResponse } from "next/server";
import { verifyDeepLinkToken } from "@/lib/deep-link-token";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { token } = await params;
    const decoded = await verifyDeepLinkToken(token);

    const url = new URL("/chat", process.env.APP_BASE_URL ?? "http://localhost:3000");
    url.searchParams.set("phone", decoded.phoneE164);
    if (decoded.bookingId) {
      url.searchParams.set("bookingId", decoded.bookingId);
    }

    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(
      new URL("/chat?link=expired", process.env.APP_BASE_URL ?? "http://localhost:3000"),
    );
  }
}
