import { addMinutes, isAfter } from "date-fns";
import { listGoogleBusyRanges, type BusyRange } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/timezone";

/** Removes busy intervals overlapping `ignore` (e.g. this booking's current Google block when rescheduling). */
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

export async function listAvailability(params: {
  staffId: string;
  serviceDurationMin: number;
  date: string;
  timeZone: string;
  /** When rescheduling, omit this booking from overlap checks. */
  excludeBookingId?: string;
}) {
  const weekday = weekdayInTimeZone(params.date, params.timeZone);

  const availability = await prisma.staffAvailability.findFirst({
    where: { staffId: params.staffId, weekday },
  });

  if (!availability) {
    return [];
  }

  const start = zonedWallTimeToUtc(
    params.date,
    availability.startHour,
    0,
    0,
    params.timeZone,
  );
  const end = zonedWallTimeToUtc(params.date, availability.endHour, 0, 0, params.timeZone);

  const existing = await prisma.booking.findMany({
    where: {
      staffId: params.staffId,
      status: { in: ["CONFIRMED", "PENDING"] },
      startsAt: { gte: start, lt: end },
      ...(params.excludeBookingId
        ? { NOT: { id: params.excludeBookingId } }
        : {}),
    },
    orderBy: { startsAt: "asc" },
  });

  const staff = await prisma.staff.findUnique({
    where: { id: params.staffId },
    select: { calendarId: true },
  });

  const freeBusy = await listGoogleBusyRanges({
    calendarId: staff?.calendarId,
    timeMin: start,
    timeMax: end,
  });

  if (!freeBusy.ok) {
    return [];
  }

  let googleBusyRanges = freeBusy.busy;
  if (params.excludeBookingId) {
    const selfBooking = await prisma.booking.findUnique({
      where: { id: params.excludeBookingId },
      select: { startsAt: true, endsAt: true },
    });
    if (selfBooking) {
      googleBusyRanges = subtractBusyWindow(googleBusyRanges, {
        start: selfBooking.startsAt,
        end: selfBooking.endsAt,
      });
    }
  }

  const slots: string[] = [];
  let cursor = start;
  // Allow a slot that ends exactly at `end` (e.g. last slot 19:00–20:00 when endHour is 20).
  while (!isAfter(addMinutes(cursor, params.serviceDurationMin), end)) {
    const slotEnd = addMinutes(cursor, params.serviceDurationMin);
    const overlaps = existing.some(
      (booking) => cursor < booking.endsAt && slotEnd > booking.startsAt,
    );
    const overlapsGoogleBusy = googleBusyRanges.some(
      (busyRange) => cursor < busyRange.end && slotEnd > busyRange.start,
    );
    if (!overlaps && !overlapsGoogleBusy) {
      slots.push(cursor.toISOString());
    }
    cursor = addMinutes(cursor, 30);
  }

  return slots;
}
