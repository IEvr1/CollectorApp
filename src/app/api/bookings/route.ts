import { addMinutes, format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { normalizePhone } from "@/lib/booking";
import { createGoogleCalendarEvent, listGoogleBusyRanges } from "@/lib/google-calendar";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { scheduleBookingReminders } from "@/lib/reminders";
import { sendBookingSms } from "@/lib/sms";

const bookingSchema = z.object({
  serviceId: z.string(),
  staffId: z.string(),
  startsAt: z.string(),
  name: z.string().min(2),
  phone: z.string().min(8),
  lang: z.string().optional(),
});

export async function POST(request: Request) {
  await ensureSalonSeed();
  const payload = bookingSchema.parse(await request.json());
  const lang = parseLocale(payload.lang);
  const t =
    lang === "el"
      ? {
          noSalon: "Δεν υπάρχει ρυθμισμένο salon.",
          serviceMissing: "Η υπηρεσία δεν βρέθηκε.",
          staffMissing: "Το staff δεν βρέθηκε.",
          slotUnavailable: "Η επιλεγμένη ώρα δεν είναι πλέον διαθέσιμη.",
          invalidPhone:
            "Υποστηρίζονται μόνο κυπριακοί αριθμοί κινητού (π.χ. +3579XXXXXXX).",
          smsConfirmed: "Το ραντεβού σας επιβεβαιώθηκε για",
          smsWith: "με",
          smsManage: "Διαχείριση ραντεβού:",
        }
      : {
          noSalon: "No salon configured",
          serviceMissing: "Service not found",
          staffMissing: "Staff not found",
          slotUnavailable: "Selected slot is no longer available",
          invalidPhone:
            "Only Cyprus mobile numbers are supported (e.g. +3579XXXXXXX).",
          smsConfirmed: "Your appointment is confirmed for",
          smsWith: "with",
          smsManage: "Manage booking:",
        };
  const dateFnsLocale = lang === "el" ? el : enGB;

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return NextResponse.json({ error: t.noSalon }, { status: 500 });
  }

  const service = await prisma.service.findUnique({ where: { id: payload.serviceId } });
  if (!service) {
    return NextResponse.json({ error: t.serviceMissing }, { status: 404 });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: payload.staffId },
    select: { id: true, name: true, calendarId: true },
  });
  if (!staff) {
    return NextResponse.json({ error: t.staffMissing }, { status: 404 });
  }

  const startsAt = new Date(payload.startsAt);
  const endsAt = addMinutes(startsAt, service.durationMin);

  const collision = await prisma.booking.findFirst({
    where: {
      staffId: payload.staffId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (collision) {
    return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
  }

  const googleBusyRanges = await listGoogleBusyRanges({
    calendarId: staff.calendarId,
    timeMin: startsAt,
    timeMax: endsAt,
  });
  const hasGoogleCollision = googleBusyRanges.some(
    (busyRange) => startsAt < busyRange.end && endsAt > busyRange.start,
  );
  if (hasGoogleCollision) {
    return NextResponse.json({ error: t.slotUnavailable }, { status: 409 });
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizePhone(payload.phone);
  } catch {
    return NextResponse.json({ error: t.invalidPhone }, { status: 400 });
  }

  const customer = await prisma.customer.upsert({
    where: { salonId_phoneE164: { salonId: salon.id, phoneE164 } },
    create: { salonId: salon.id, name: payload.name, phoneE164 },
    update: { name: payload.name },
  });

  const booking = await prisma.booking.create({
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

  const googleEventId = await createGoogleCalendarEvent({
    calendarId: staff.calendarId,
    summary: `${booking.service.name} - ${customer.name}`,
    description: `Phone: ${customer.phoneE164}`,
    start: booking.startsAt,
    end: booking.endsAt,
  });

  if (googleEventId) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { googleEventId },
    });
  }

  const token = await createDeepLinkToken({
    salonId: salon.id,
    phoneE164,
    bookingId: booking.id,
  });
  const manageUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/r/${token}`;
  const message = `${t.smsConfirmed} ${format(startsAt, "PPP p", {
    locale: dateFnsLocale,
  })} ${t.smsWith} ${booking.staff.name}. ${t.smsManage} ${manageUrl}`;

  await sendBookingSms({ phoneE164, body: message });
  await scheduleBookingReminders({ bookingId: booking.id, startsAt: booking.startsAt });

  return NextResponse.json({ bookingId: booking.id, manageUrl });
}
