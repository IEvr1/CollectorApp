import { addMinutes, format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { normalizePhone } from "@/lib/phone";
import { createGoogleCalendarEvent, listGoogleBusyRanges } from "@/lib/google-calendar";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { scheduleBookingReminders } from "@/lib/reminders";
import { isSalonClosedOnLocalDate } from "@/lib/salon-closure";
import { sendBookingSms } from "@/lib/sms";
import { isoDateInTimeZone } from "@/lib/timezone";

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
          smsConfirmed: "Επιβεβαιώθηκε ραντεβού στο",
          smsWith: "με",
          smsManage: "Διαχείριση ραντεβού:",
          smsLinkNote: " (Προσωπικό link — μην προωθείτε.)",
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
          smsConfirmed: "Appointment confirmed at",
          smsWith: "with",
          smsManage: "Manage booking:",
          smsLinkNote: " (Personal link — do not forward.)",
          calendarUnavailable:
            "Availability could not be verified right now. Please try again.",
          salonClosed: "The salon is closed on this date. Please pick another day.",
        };
  const dateFnsLocale = lang === "el" ? el : enGB;

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

  const staff = await prisma.staff.findUnique({
    where: { id: payload.staffId },
    select: { id: true, name: true, calendarId: true, salonId: true },
  });
  if (!staff || staff.salonId !== salon.id) {
    return NextResponse.json({ error: t.staffMissing }, { status: 404 });
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
              staffId: payload.staffId,
              status: { in: ["PENDING", "CONFIRMED"] },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (collision) {
            return { type: "conflict" as const };
          }

          const customer = await tx.customer.upsert({
            where: { salonId_phoneE164: { salonId: salon.id, phoneE164 } },
            create: { salonId: salon.id, name: payload.name, phoneE164 },
            update: { name: payload.name },
          });

          const booking = await tx.booking.create({
            data: {
              salonId: salon.id,
              customerId: customer.id,
              serviceId: payload.serviceId,
              staffId: payload.staffId,
              startsAt,
              endsAt,
              status: "CONFIRMED",
            },
            include: { service: true, staff: true },
          });

          return { type: "ok" as const, booking, customer };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result.type === "conflict") {
        return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
      }

      const { booking, customer } = result;

      const eventResult = await createGoogleCalendarEvent({
        calendarId: staff.calendarId,
        summary: `${booking.service.name} - ${customer.name}`,
        description: `Phone: ${customer.phoneE164}`,
        start: booking.startsAt,
        end: booking.endsAt,
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
      const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const manageUrl = `${base}/l/${shortCode}`;
      const when = format(startsAt, "PPP p", { locale: dateFnsLocale });
      const message =
        lang === "el"
          ? `${t.smsConfirmed} ${salon.name}. Υπηρεσία: ${booking.service.name}. ${when} ${t.smsWith} ${booking.staff.name}. ${t.smsManage} ${manageUrl}${t.smsLinkNote}`
          : `${t.smsConfirmed} ${salon.name}. Service: ${booking.service.name}. ${when} ${t.smsWith} ${booking.staff.name}. ${t.smsManage} ${manageUrl}${t.smsLinkNote}`;

      try {
        await sendBookingSms({ phoneE164, body: message });
      } catch (smsError) {
        console.error("SMS send failed after booking created; rolling back booking", smsError);
        await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {});
        return NextResponse.json(
          { error: lang === "el" ? "Αποτυχία αποστολής SMS. Δοκιμάστε ξανά." : "SMS failed. Please try again." },
          { status: 502 },
        );
      }

      await scheduleBookingReminders({ bookingId: booking.id, startsAt: booking.startsAt });

      return NextResponse.json({ bookingId: booking.id, manageUrl });
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
