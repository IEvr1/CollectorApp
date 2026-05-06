import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { MANAGE_SESSION_COOKIE, signManageSessionCookieValue } from "@/lib/manage-session";

const bodySchema = z.object({
  bookingId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getManageSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: body.bookingId, salonId: session.salonId },
    include: { customer: true },
  });

  if (!booking || booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieValue = signManageSessionCookieValue({
    salonId: session.salonId,
    phoneE164: session.phoneE164,
    bookingId: booking.id,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MANAGE_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  return res;
}
