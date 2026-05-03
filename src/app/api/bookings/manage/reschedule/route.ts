import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { listAvailability } from "@/lib/booking";
import {
  listGoogleBusyRanges,
  patchGoogleCalendarEvent,
  type BusyRange,
} from "@/lib/google-calendar";
import { getManageSessionPayload } from "@/lib/manage-from-request";
import { prisma } from "@/lib/prisma";
import { scheduleBookingReminders } from "@/lib/reminders";

const bodySchema = z.object({
  startsAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: "Invalid startsAt" })
    .transform((s) => new Date(s)),
});

const MAX_SERIALIZATION_RETRIES = 5;

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
    include: { customer: true, service: true, staff: true, salon: true },
  });

  if (!booking || booking.customer.phoneE164 !== session.phoneE164) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return NextResponse.json({ error: "Booking not manageable" }, { status: 409 });
  }

  const endsAt = addMinutes(startsAt, booking.service.durationMin);
  if (startsAt < now) {
    return NextResponse.json({ error: "Slot in the past" }, { status: 409 });
  }

  const dateStr = startsAt.toISOString().slice(0, 10);
  const slots = await listAvailability({
    staffId: booking.staffId,
    serviceDurationMin: booking.service.durationMin,
    date: dateStr,
    timeZone: booking.salon.timezone,
    excludeBookingId: booking.id,
  });

  const slotOk = slots.some((iso) => new Date(iso).getTime() === startsAt.getTime());
  if (!slotOk) {
    return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
  }

  const freeBusy = await listGoogleBusyRanges({
    calendarId: booking.staff.calendarId,
    timeMin: startsAt,
    timeMax: endsAt,
  });
  if (!freeBusy.ok) {
    return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 });
  }
  const googleBusyAdjusted = subtractBusyWindow(freeBusy.busy, {
    start: booking.startsAt,
    end: booking.endsAt,
  });
  const hasGoogleCollision = googleBusyAdjusted.some(
    (busyRange) => startsAt < busyRange.end && endsAt > busyRange.start,
  );
  if (hasGoogleCollision) {
    return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
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
      });

      if (!patch.ok) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { startsAt: prevStarts, endsAt: prevEnds },
        });
        return NextResponse.json({ error: patch.reason }, { status: 503 });
      }

      await prisma.bookingReminder.deleteMany({
        where: { bookingId: booking.id, sentAt: null },
      });
      await scheduleBookingReminders({ bookingId: booking.id, startsAt });

      return NextResponse.json({ ok: true, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    } catch (error) {
      if (error instanceof Error && error.message === "CONFLICT") {
        return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
      }
      lastError = error;
      if (isSerializationFailure(error)) {
        continue;
      }
      throw error;
    }
  }

  console.error("Reschedule failed after retries", lastError);
  return NextResponse.json({ error: "Slot unavailable" }, { status: 409 });
}
