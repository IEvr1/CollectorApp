"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { Locale } from "@/lib/locale";
import { cancelBookingAsAdmin } from "@/lib/cancel-booking-admin";
import { listAvailability } from "@/lib/booking";
import { isDashboardMutationAuthorized } from "@/lib/dashboard-auth";
import { prisma } from "@/lib/prisma";
import { rescheduleBookingCore } from "@/lib/reschedule-booking";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function unauthorizedMessage(lang: Locale) {
  return lang === "el"
    ? "Η ενέργεια απαιτεί Basic auth (DASHBOARD_AUTH_SECRET)."
    : "This action requires Basic auth (DASHBOARD_AUTH_SECRET).";
}

export async function getDashboardRescheduleSlots(bookingId: string, date: string, lang: Locale) {
  const h = await headers();
  if (!isDashboardMutationAuthorized(h)) {
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
  if (!isDashboardMutationAuthorized(h)) {
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
  if (!isDashboardMutationAuthorized(h)) {
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
  if (!isDashboardMutationAuthorized(h)) {
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
  return { ok: true as const };
}

export async function deleteSalonClosureFromDashboard(closureId: string, lang: Locale) {
  const h = await headers();
  if (!isDashboardMutationAuthorized(h)) {
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
  return { ok: true as const };
}
