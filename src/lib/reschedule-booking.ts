import { addMinutes } from "date-fns";
import { Prisma } from "@prisma/client";
import { listAvailability } from "@/lib/booking";
import { isSalonClosedOnLocalDate } from "@/lib/salon-closure";
import {
  listGoogleBusyRanges,
  patchGoogleCalendarEvent,
  type BusyRange,
} from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { scheduleBookingReminders } from "@/lib/reminders";
import { isoDateInTimeZone } from "@/lib/timezone";

const MAX_SERIALIZATION_RETRIES = 5;

export type BookingForReschedule = Prisma.BookingGetPayload<{
  include: { customer: true; service: true; staff: true; salon: true };
}>;

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function subtractBusyWindow(busy: BusyRange[], ignore: { start: Date; end: Date }): BusyRange[] {
  const out: BusyRange[] = [];
  for (const r of busy) {
    if (r.end <= ignore.start || r.start >= ignore.end) {
      out.push(r);
      continue;
    }
    if (r.start < ignore.start) {
      out.push({ start: r.start, end: new Date(Math.min(r.end.getTime(), ignore.start.getTime())) });
    }
    if (r.end > ignore.end) {
      out.push({ start: new Date(Math.max(r.start.getTime(), ignore.end.getTime())), end: r.end });
    }
  }
  return out.filter((x) => x.start < x.end);
}

export type RescheduleBookingError =
  | "not_manageable"
  | "slot_in_past"
  | "slot_unavailable"
  | "calendar_unavailable"
  | "google_patch_failed"
  | "serialization_exhausted";

/**
 * Moves a confirmed future booking to a new start time (same staff/service/duration).
 * Caller must enforce authorization (manage session or dashboard).
 */
export async function rescheduleBookingCore(
  booking: BookingForReschedule,
  startsAt: Date,
): Promise<{ ok: true; startsAt: Date; endsAt: Date } | { ok: false; error: RescheduleBookingError }> {
  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return { ok: false, error: "not_manageable" };
  }

  const endsAt = addMinutes(startsAt, booking.service.durationMin);
  if (startsAt < now) {
    return { ok: false, error: "slot_in_past" };
  }

  const dateStr = isoDateInTimeZone(startsAt, booking.salon.timezone);
  if (await isSalonClosedOnLocalDate(booking.salonId, dateStr)) {
    return { ok: false, error: "slot_unavailable" };
  }

  const slots = await listAvailability({
    staffId: booking.staffId,
    serviceDurationMin: booking.service.durationMin,
    date: dateStr,
    timeZone: booking.salon.timezone,
    salonId: booking.salonId,
    excludeBookingId: booking.id,
  });

  const slotOk = slots.some((iso) => new Date(iso).getTime() === startsAt.getTime());
  if (!slotOk) {
    return { ok: false, error: "slot_unavailable" };
  }

  const freeBusy = await listGoogleBusyRanges({
    calendarId: booking.staff.calendarId,
    timeMin: startsAt,
    timeMax: endsAt,
  });
  if (!freeBusy.ok) {
    return { ok: false, error: "calendar_unavailable" };
  }
  const googleBusyAdjusted = subtractBusyWindow(freeBusy.busy, {
    start: booking.startsAt,
    end: booking.endsAt,
  });
  const hasGoogleCollision = googleBusyAdjusted.some(
    (busyRange) => startsAt < busyRange.end && endsAt > busyRange.start,
  );
  if (hasGoogleCollision) {
    return { ok: false, error: "slot_unavailable" };
  }

  const prevStarts = booking.startsAt;
  const prevEnds = booking.endsAt;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const collision = await tx.booking.findFirst({
            where: {
              staffId: booking.staffId,
              id: { not: booking.id },
              status: { in: ["PENDING", "CONFIRMED"] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (collision) {
            throw new Error("CONFLICT");
          }
          await tx.booking.update({
            where: { id: booking.id },
            data: { startsAt, endsAt },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const patch = await patchGoogleCalendarEvent({
        calendarId: booking.staff.calendarId,
        eventId: booking.googleEventId,
        start: startsAt,
        end: endsAt,
        timeZone: booking.salon.timezone,
      });

      if (!patch.ok) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { startsAt: prevStarts, endsAt: prevEnds },
        });
        return { ok: false, error: "google_patch_failed" };
      }

      await prisma.bookingReminder.deleteMany({
        where: { bookingId: booking.id, sentAt: null },
      });
      await scheduleBookingReminders({
        bookingId: booking.id,
        startsAt,
        timeZone: booking.salon.timezone,
      });

      return { ok: true, startsAt, endsAt };
    } catch (error) {
      if (error instanceof Error && error.message === "CONFLICT") {
        return { ok: false, error: "slot_unavailable" };
      }
      lastError = error;
      if (isSerializationFailure(error)) {
        continue;
      }
      throw error;
    }
  }

  console.error("Reschedule failed after retries", lastError);
  return { ok: false, error: "serialization_exhausted" };
}
