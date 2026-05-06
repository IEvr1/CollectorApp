import type { Prisma } from "@prisma/client";
import { deleteGoogleCalendarEvent } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

export type BookingForAdminCancel = Prisma.BookingGetPayload<{
  include: { staff: true };
}>;

export async function cancelBookingAsAdmin(
  booking: BookingForAdminCancel,
): Promise<{ ok: true } | { ok: false; error: "not_cancellable" | "calendar_failed" }> {
  const now = new Date();
  if (!["PENDING", "CONFIRMED"].includes(booking.status) || booking.endsAt <= now) {
    return { ok: false, error: "not_cancellable" };
  }

  const prevStatus = booking.status;

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });

  const del = await deleteGoogleCalendarEvent({
    calendarId: booking.staff.calendarId,
    eventId: booking.googleEventId,
  });

  if (!del.ok) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: prevStatus },
    });
    return { ok: false, error: "calendar_failed" };
  }

  await prisma.bookingReminder.deleteMany({
    where: { bookingId: booking.id, sentAt: null },
  });

  return { ok: true };
}
