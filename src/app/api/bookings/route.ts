import { addMinutes } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { listAvailability } from "@/lib/booking";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { normalizePhone } from "@/lib/phone";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleBusyRanges,
} from "@/lib/google-calendar";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { scheduleBookingReminders } from "@/lib/reminders";
import { isSalonClosedOnLocalDate } from "@/lib/salon-closure";
import { sendBookingSms } from "@/lib/sms";
import { getSmsLinkBaseUrl } from "@/lib/sms-link-base";
import { ANY_AVAILABLE_STAFF_ID } from "@/lib/staff-selection";
import { formatSalonDateTime, isoDateInTimeZone } from "@/lib/timezone";

const bookingSchema = z.object({
  serviceId: z.string(),
  staffId: z.string(),
  startsAt: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: "Invalid startsAt" })
    .transform((s) => new Date(s)),
  name: z.string().min(2),
  phone: z.string().min(8),
  lang: z.string().optional(),
});

const MAX_SERIALIZATION_RETRIES = 5;

function isSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function POST(request: Request) {
  await ensureSalonSeed();

  if (process.env.NODE_ENV === "production" && !process.env.SMS_LINK_SECRET) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let payload: z.infer<typeof bookingSchema>;
  try {
    payload = bookingSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const lang = parseLocale(payload.lang);
  const t =
    lang === "el"
      ? {
          noSalon: "Δεν υπάρχει ρυθμισμένο salon.",
          serviceMissing: "Η υπηρεσία δεν βρέθηκε.",
          staffMissing: "Το staff δεν βρέθηκε.",
          slotUnavailable: "Η επιλεγμένη ώρα δεν είναι πλέον διαθέσιμη.",
          invalidPhone:
            "Βάλτε έγκυρο κυπριακό κινητό: 8 ψηφία (π.χ. 99XXXXXX χωρίς +357).",
          calendarUnavailable:
            "Η διαθεσιμότητα δεν μπορεί να επιβεβαιωθεί αυτή τη στιγμή. Δοκιμάστε ξανά.",
          salonClosed: "Το κομμωτήριο είναι κλειστά αυτή την ημερομηνία. Επιλέξτε άλλη μέρα.",
        }
      : {
          noSalon: "No salon configured",
          serviceMissing: "Service not found",
          staffMissing: "Staff not found",
          slotUnavailable: "Selected slot is no longer available",
          invalidPhone:
            "Enter a valid Cyprus mobile: 8 digits (e.g. 99XXXXXX without +357).",
          calendarUnavailable:
            "Availability could not be verified right now. Please try again.",
          salonClosed: "The salon is closed on this date. Please pick another day.",
        };

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return NextResponse.json({ error: t.noSalon }, { status: 500 });
  }

  const service = await prisma.service.findUnique({
    where: { id: payload.serviceId },
  });
  if (!service || service.salonId !== salon.id) {
    return NextResponse.json({ error: t.serviceMissing }, { status: 404 });
  }

  const startsAt = payload.startsAt;
  const endsAt = addMinutes(startsAt, service.durationMin);
  const now = new Date();
  if (startsAt < now) {
    return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
  }

  const localDate = isoDateInTimeZone(startsAt, salon.timezone);
  if (await isSalonClosedOnLocalDate(salon.id, localDate)) {
    return NextResponse.json({ error: t.salonClosed }, { status: 409 });
  }

  const staffSelect = { id: true, name: true, calendarId: true, salonId: true } as const;
  const useAnyAvailableStaff = payload.staffId === ANY_AVAILABLE_STAFF_ID;
  let staff: { id: string; name: string; calendarId: string | null; salonId: string } | null = null;

  if (useAnyAvailableStaff) {
    const candidates = await prisma.staff.findMany({
      where: { salonId: salon.id },
      select: staffSelect,
      orderBy: { createdAt: "asc" },
    });

    for (const candidate of candidates) {
      const candidateSlots = await listAvailability({
        staffId: candidate.id,
        serviceDurationMin: service.durationMin,
        date: localDate,
        timeZone: salon.timezone,
        salonId: salon.id,
      });
      if (candidateSlots.includes(startsAt.toISOString())) {
        staff = candidate;
        break;
      }
    }
  } else {
    staff = await prisma.staff.findUnique({
      where: { id: payload.staffId },
      select: staffSelect,
    });
  }

  if (!staff || staff.salonId !== salon.id) {
    return NextResponse.json(
      { error: useAnyAvailableStaff ? t.slotUnavailable : t.staffMissing },
      { status: useAnyAvailableStaff ? 409 : 404 },
    );
  }

  const freeBusy = await listGoogleBusyRanges({
    calendarId: staff.calendarId,
    timeMin: startsAt,
    timeMax: endsAt,
  });
  if (!freeBusy.ok) {
    return NextResponse.json({ error: t.calendarUnavailable }, { status: 503 });
  }
  const hasGoogleCollision = freeBusy.busy.some(
    (busyRange) => startsAt < busyRange.end && endsAt > busyRange.start,
  );
  if (hasGoogleCollision) {
    return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizePhone(payload.phone);
  } catch {
    return NextResponse.json(
      { error: t.invalidPhone, code: "INVALID_PHONE" },
      { status: 400 },
    );
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const collision = await tx.booking.findFirst({
            where: {
              staffId: staff.id,
              status: { in: ["PENDING", "CONFIRMED"] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (collision) {
            return { type: "conflict" as const };
          }

          const existing = await tx.customer.findUnique({
            where: { salonId_phoneE164: { salonId: salon.id, phoneE164 } },
            select: { id: true, name: true },
          });

          const customer = await tx.customer.upsert({
            where: { salonId_phoneE164: { salonId: salon.id, phoneE164 } },
            create: { salonId: salon.id, name: payload.name, phoneE164 },
            update: { name: payload.name },
          });

          const linkedExistingCustomer = existing !== null;
          const nameChanged =
            linkedExistingCustomer &&
            existing.name.trim().toLocaleLowerCase() !==
              payload.name.trim().toLocaleLowerCase();

          const booking = await tx.booking.create({
            data: {
              salonId: salon.id,
              customerId: customer.id,
              serviceId: payload.serviceId,
              staffId: staff.id,
              startsAt,
              endsAt,
              status: "CONFIRMED",
            },
            include: { service: true, staff: true },
          });

          return {
            type: "ok" as const,
            booking,
            customer,
            linkedExistingCustomer,
            nameChanged,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result.type === "conflict") {
        return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
      }

      const { booking, customer, linkedExistingCustomer, nameChanged } = result;

      const eventResult = await createGoogleCalendarEvent({
        calendarId: staff.calendarId,
        summary: `${booking.service.name} - ${customer.name}`,
        description: `Phone: ${customer.phoneE164}`,
        start: booking.startsAt,
        end: booking.endsAt,
        timeZone: salon.timezone,
      });

      if (!eventResult.ok) {
        await prisma.booking.delete({ where: { id: booking.id } });
        return NextResponse.json({ error: t.calendarUnavailable }, { status: 503 });
      }

      if (eventResult.eventId) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { googleEventId: eventResult.eventId },
        });
      }

      const { shortCode } = await createDeepLinkToken({
        salonId: salon.id,
        phoneE164,
        bookingId: booking.id,
      });
      const base = getSmsLinkBaseUrl(request);
      const manageUrl = `${base}/l/${shortCode}`;
      const when = formatSalonDateTime(startsAt, salon.timezone);
      const message = `${salon.name}: Booked ${when}. Manage Booking: ${manageUrl}`;

      try {
        await sendBookingSms({ phoneE164, body: message });
      } catch (smsError) {
        console.error("SMS send failed after booking created; rolling back booking", smsError);
        await deleteGoogleCalendarEvent({
          calendarId: staff.calendarId,
          eventId: eventResult.eventId,
        }).catch(() => {});
        await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
        return NextResponse.json(
          { error: lang === "el" ? "Αποτυχία κράτησης. Δοκιμάστε ξανά." : "Booking failed. Please try again." },
          { status: 502 },
        );
      }

      await scheduleBookingReminders({
        bookingId: booking.id,
        startsAt: booking.startsAt,
        timeZone: salon.timezone,
      });

      return NextResponse.json({
        bookingId: booking.id,
        manageUrl,
        linkedExistingCustomer,
        nameChanged,
      });
    } catch (error) {
      lastError = error;
      if (isSerializationFailure(error)) {
        continue;
      }
      throw error;
    }
  }

  console.error("Booking transaction failed after retries", lastError);
  return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
}
