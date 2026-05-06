import { NextResponse } from "next/server";
import { format } from "date-fns";
import { deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { prisma } from "@/lib/prisma";
import { sendBookingSms } from "@/lib/sms";

export async function POST() {
  const session = await getManageSessionPayload();
  if (!session?.bookingId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const booking = await prisma.booking.findFirst({
    where: { id: session.bookingId, salonId: session.salonId },
    include: { customer: true, staff: true, salon: true },
  });

  if (!booking || booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return NextResponse.json({ error: "Booking cannot be cancelled" }, { status: 409 });
  }

  const gcal = await deleteGoogleCalendarEvent({
    calendarId: booking.staff.calendarId,
    eventId: booking.googleEventId,
  });

  if (!gcal.ok) {
    return NextResponse.json({ error: gcal.reason }, { status: 503 });
  }

  await prisma.$transaction([
    prisma.bookingReminder.deleteMany({ where: { bookingId: booking.id } }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", googleEventId: null },
    }),
  ]);

  const when = format(booking.startsAt, "yyyy-MM-dd HH:mm");
  const body = `${booking.salon.name}: Cancelled ${when}.`;

  try {
    await sendBookingSms({ phoneE164: booking.customer.phoneE164, body });
  } catch (smsError) {
    console.error("Manage cancel SMS failed", smsError);
  }

  return NextResponse.json({ ok: true });
}
