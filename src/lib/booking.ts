import { addMinutes, isBefore, set } from "date-fns";
import { listGoogleBusyRanges } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

export async function listAvailability(params: {
  staffId: string;
  serviceDurationMin: number;
  date: string;
}) {
  const dateObj = new Date(`${params.date}T00:00:00`);
  const weekday = dateObj.getDay();

  const availability = await prisma.staffAvailability.findFirst({
    where: { staffId: params.staffId, weekday },
  });

  if (!availability) {
    return [];
  }

  const start = set(dateObj, {
    hours: availability.startHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
  const end = set(dateObj, {
    hours: availability.endHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });

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

  const googleBusyRanges = await listGoogleBusyRanges({
    calendarId: staff?.calendarId,
    timeMin: start,
    timeMax: end,
  });

  const slots: string[] = [];
  let cursor = start;
  while (isBefore(addMinutes(cursor, params.serviceDurationMin), end)) {
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
