"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { Locale } from "@/lib/locale";
import { cancelBookingAsAdmin } from "@/lib/cancel-booking-admin";
import { listAvailability } from "@/lib/booking";
import { isDashboardMutationAuthorized } from "@/lib/dashboard-auth";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { rescheduleBookingCore } from "@/lib/reschedule-booking";
import { sendBookingSms } from "@/lib/sms";
import { getSmsLinkBaseUrl } from "@/lib/sms-link-base";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()));
const calendarOnlyRescheduleSchema = z.object({
  calendarId: z.string().min(1),
  googleEventId: z.string().min(1),
  staffId: z.string().min(1),
  serviceName: z.string().min(1),
  customerName: z.string().min(1),
  phoneE164: z.string().min(4),
  startsAtIso: isoDateTimeSchema,
  endsAtIso: isoDateTimeSchema,
});

function unauthorizedMessage(lang: Locale) {
  return lang === "el"
    ? "Η ενέργεια απαιτεί έγκυρο dashboard link."
    : "This action requires a valid dashboard link.";
}

function sameText(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

async function sendRescheduleRequestSms(
  bookingId: string,
  lang: Locale,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, salon: true },
  });
  if (!booking) {
    return { ok: false, error: lang === "el" ? "Δεν βρέθηκε." : "Not found." };
  }

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return { ok: false, error: lang === "el" ? "Μη διαχειρίσιμο." : "Not manageable." };
  }

  const { shortCode } = await createDeepLinkToken(
    {
      salonId: booking.salonId,
      phoneE164: booking.customer.phoneE164,
      bookingId: booking.id,
    },
    { ttlSeconds: 72 * 60 * 60 },
  );
  const manageUrl = `${getSmsLinkBaseUrl()}/l/${shortCode}`;
  const body =
    lang === "el"
      ? `${booking.salon.name}: Χρειάζεται αλλαγή ώρας για το ραντεβού σας λόγω έκτακτης ανάγκης. Επιλέξτε νέα ώρα: ${manageUrl}`
      : `${booking.salon.name}: Your appointment needs rescheduling due to an emergency. Pick a new time: ${manageUrl}`;

  await sendBookingSms({ phoneE164: booking.customer.phoneE164, body });
  return { ok: true };
}

export async function sendRescheduleRequestFromDashboard(bookingId: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  try {
    return await sendRescheduleRequestSms(bookingId, lang);
  } catch (error) {
    console.error("Dashboard reschedule request SMS failed", error);
    return {
      ok: false as const,
      error: lang === "el" ? "Αποτυχία αποστολής SMS." : "SMS failed.",
    };
  }
}

export async function sendCalendarOnlyRescheduleRequestFromDashboard(
  input: z.infer<typeof calendarOnlyRescheduleSchema>,
  lang: Locale,
) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  let data: z.infer<typeof calendarOnlyRescheduleSchema>;
  try {
    data = calendarOnlyRescheduleSchema.parse(input);
  } catch {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρα στοιχεία." : "Invalid details." };
  }

  let phoneE164: string;
  try {
    phoneE164 = normalizePhone(data.phoneE164);
  } catch {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρο τηλέφωνο." : "Invalid phone." };
  }

  const startsAt = new Date(data.startsAtIso);
  const endsAt = new Date(data.endsAtIso);
  if (startsAt >= endsAt || endsAt <= new Date()) {
    return { ok: false as const, error: lang === "el" ? "Μη διαχειρίσιμο." : "Not manageable." };
  }

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return { ok: false as const, error: lang === "el" ? "Δεν υπάρχει salon." : "No salon configured." };
  }

  const staff = await prisma.staff.findFirst({
    where: { id: data.staffId, salonId: salon.id, active: true },
  });
  if (!staff) {
    return { ok: false as const, error: lang === "el" ? "Το staff δεν βρέθηκε." : "Staff not found." };
  }

  const services = await prisma.service.findMany({
    where: { salonId: salon.id, active: true },
  });
  const service = services.find((s) => sameText(s.name, data.serviceName));
  if (!service) {
    return {
      ok: false as const,
      error: lang === "el" ? "Η υπηρεσία δεν βρέθηκε στη βάση." : "Service not found in the database.",
    };
  }

  const existing = await prisma.booking.findFirst({
    where: { salonId: salon.id, googleEventId: data.googleEventId },
  });
  const booking =
    existing ??
    (await prisma.booking.create({
      data: {
        salonId: salon.id,
        customerId: (
          await prisma.customer.upsert({
            where: { salonId_phoneE164: { salonId: salon.id, phoneE164 } },
            create: { salonId: salon.id, phoneE164, name: data.customerName },
            update: { name: data.customerName },
          })
        ).id,
        serviceId: service.id,
        staffId: staff.id,
        startsAt,
        endsAt,
        googleEventId: data.googleEventId,
        status: "CONFIRMED",
      },
    }));

  try {
    const result = await sendRescheduleRequestSms(booking.id, lang);
    if (!result.ok) {
      return result;
    }
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (error) {
    console.error("Dashboard calendar-only reschedule request failed", error);
    return {
      ok: false as const,
      error: lang === "el" ? "Αποτυχία αποστολής SMS." : "SMS failed.",
    };
  }
}

export async function getDashboardRescheduleSlots(bookingId: string, date: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  let parsedDate: string;
  try {
    parsedDate = dateSchema.parse(date);
  } catch {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρη ημερομηνία." : "Invalid date." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true, salon: true },
  });

  if (!booking) {
    return { ok: false as const, error: lang === "el" ? "Δεν βρέθηκε." : "Not found." };
  }

  const now = new Date();
  if (booking.status !== "CONFIRMED" || booking.endsAt <= now) {
    return { ok: false as const, error: lang === "el" ? "Μη διαχειρίσιμο." : "Not manageable." };
  }

  const slots = await listAvailability({
    staffId: booking.staffId,
    serviceDurationMin: booking.service.durationMin,
    date: parsedDate,
    timeZone: booking.salon.timezone,
    salonId: booking.salonId,
    excludeBookingId: booking.id,
  });

  return { ok: true as const, slots };
}

export async function rescheduleBookingFromDashboard(bookingId: string, startsAtIso: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρη ώρα." : "Invalid time." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, service: true, staff: true, salon: true },
  });

  if (!booking) {
    return { ok: false as const, error: lang === "el" ? "Δεν βρέθηκε." : "Not found." };
  }

  const result = await rescheduleBookingCore(booking, startsAt);
  if (!result.ok) {
    const msg =
      result.error === "calendar_unavailable" || result.error === "google_patch_failed"
        ? lang === "el"
          ? "Το ημερολόγιο δεν είναι διαθέσιμο."
          : "Calendar unavailable."
        : lang === "el"
          ? "Η ώρα δεν είναι διαθέσιμη."
          : "Slot unavailable.";
    return { ok: false as const, error: msg };
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function cancelBookingFromDashboard(bookingId: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { staff: true },
  });

  if (!booking) {
    return { ok: false as const, error: lang === "el" ? "Δεν βρέθηκε." : "Not found." };
  }

  const result = await cancelBookingAsAdmin(booking);
  if (!result.ok) {
    const msg =
      result.error === "not_cancellable"
        ? lang === "el"
          ? "Δεν μπορεί να ακυρωθεί."
          : "Cannot cancel."
        : lang === "el"
          ? "Αποτυχία ημερολογίου."
          : "Calendar delete failed.";
    return { ok: false as const, error: msg };
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function addSalonClosureFromDashboard(
  startDate: string,
  endDate: string,
  label: string | undefined,
  lang: Locale,
) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  let s: string;
  let e: string;
  try {
    s = dateSchema.parse(startDate.trim());
    e = dateSchema.parse(endDate.trim());
  } catch {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρες ημερομηνίες." : "Invalid dates." };
  }

  if (s > e) {
    return {
      ok: false as const,
      error: lang === "el" ? "Η αρχή δεν μπορεί να είναι μετά το τέλος." : "Start cannot be after end.",
    };
  }

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return { ok: false as const, error: lang === "el" ? "Δεν υπάρχει salon." : "No salon configured." };
  }

  await prisma.salonClosure.create({
    data: {
      salonId: salon.id,
      startDate: s,
      endDate: e,
      label: label?.trim() ? label.trim() : null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closures");
  return { ok: true as const };
}

export async function deleteSalonClosureFromDashboard(closureId: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return { ok: false as const, error: lang === "el" ? "Δεν υπάρχει salon." : "No salon configured." };
  }

  const deleted = await prisma.salonClosure.deleteMany({
    where: { id: closureId, salonId: salon.id },
  });

  if (deleted.count === 0) {
    return { ok: false as const, error: lang === "el" ? "Δεν βρέθηκε." : "Not found." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/closures");
  return { ok: true as const };
}
