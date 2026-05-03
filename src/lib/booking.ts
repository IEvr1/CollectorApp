import { addMinutes, isAfter } from "date-fns";
import { listGoogleBusyRanges } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/timezone";

export function normalizePhone(raw: string) {
  const digitsOnly = raw.replace(/\D/g, "");

  // Cyprus mobile numbers only (for SMS): +3579XXXXXXX or local 9XXXXXXX.
  if (/^3579\d{7}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  if (/^9\d{7}$/.test(digitsOnly)) {
    return `+357${digitsOnly}`;
  }

  throw new Error("Only Cyprus mobile numbers are supported (e.g. +3579XXXXXXX).");
}

export async function listAvailability(params: {
  staffId: string;
  serviceDurationMin: number;
  date: string;
  timeZone: string;
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

  const googleBusyRanges = freeBusy.busy;

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
