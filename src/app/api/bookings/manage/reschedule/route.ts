import { NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { prisma } from "@/lib/prisma";
import { rescheduleBookingCore } from "@/lib/reschedule-booking";
import { sendBookingSms } from "@/lib/sms";

const bodySchema = z.object({
  startsAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: "Invalid startsAt" })
    .transform((s) => new Date(s)),
});

function mapErrorToResponse(error: string) {
  switch (error) {
    case "not_manageable":
      return NextResponse.json({ error: "Booking not manageable" }, { status: 409 });
    case "slot_in_past":
      return NextResponse.json({ error: "Slot in the past" }, { status: 409 });
    case "slot_unavailable":
      return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
    case "calendar_unavailable":
      return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 });
    case "google_patch_failed":
      return NextResponse.json({ error: "Calendar update failed" }, { status: 503 });
    case "serialization_exhausted":
      return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
    default:
      return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
  }
}

export async function POST(request: Request) {
  const session = await getManageSessionPayload();
  if (!session?.bookingId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let startsAt: Date;
  try {
    startsAt = bodySchema.parse(await request.json()).startsAt;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: session.bookingId, salonId: session.salonId },
    include: { customer: true, salon: true, service: true, staff: true },
  });

  if (!booking || booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await rescheduleBookingCore(booking, startsAt);
  if (!result.ok) {
    return mapErrorToResponse(result.error);
  }

  const when = format(result.startsAt, "yyyy-MM-dd HH:mm");
  const body = `${booking.salon.name}: New time ${when}.`;
  try {
    await sendBookingSms({ phoneE164: booking.customer.phoneE164, body });
  } catch (smsError) {
    console.error("Manage reschedule SMS failed", smsError);
  }

  return NextResponse.json({
    ok: true,
    startsAt: result.startsAt.toISOString(),
    endsAt: result.endsAt.toISOString(),
  });
}
