"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { headers } from "next/headers";
import { z } from "zod";
import type { Locale } from "@/lib/locale";
import { cancelBookingAsAdmin } from "@/lib/cancel-booking-admin";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { isDashboardMutationAuthorized } from "@/lib/dashboard-auth";
import { prisma } from "@/lib/prisma";
import { sendBookingSms } from "@/lib/sms";
import { getSmsLinkBaseUrl } from "@/lib/sms-link-base";
import { salonLocalDayBoundsUtc } from "@/lib/timezone";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function emergencyTtlSeconds(): number {
  const raw = process.env.SMS_LINK_TTL_EMERGENCY_SECONDS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const fallback = 72 * 60 * 60;
  if (!Number.isFinite(parsed) || parsed < 60) {
    return fallback;
  }
  return Math.min(7 * 24 * 60 * 60, parsed);
}

function unauthorizedMessage(lang: Locale) {
  return lang === "el"
    ? "Η ενέργεια απαιτεί έγκυρο dashboard link."
    : "This action requires a valid dashboard link.";
}

export async function emergencyCancelDayAndNotify(isoDate: string, lang: Locale) {
  const h = await headers();
  if (!(await isDashboardMutationAuthorized(h))) {
    return { ok: false as const, error: unauthorizedMessage(lang) };
  }

  try {
    dateSchema.parse(isoDate);
  } catch {
    return { ok: false as const, error: lang === "el" ? "Μη έγκυρη ημερομηνία." : "Invalid date." };
  }

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return { ok: false as const, error: lang === "el" ? "Δεν υπάρχει salon." : "No salon configured." };
  }

  const { start, endExclusive } = salonLocalDayBoundsUtc(isoDate, salon.timezone);

  const bookings = await prisma.booking.findMany({
    where: {
      salonId: salon.id,
      startsAt: { gte: start, lt: endExclusive },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    include: { staff: true, customer: true, service: true },
    orderBy: { startsAt: "asc" },
  });

  const calendarFailures: { bookingId: string }[] = [];
  const cancelledIds: string[] = [];

  for (const b of bookings) {
    const r = await cancelBookingAsAdmin(b);
    if (!r.ok) {
      if (r.error === "calendar_failed") {
        calendarFailures.push({ bookingId: b.id });
      }
      continue;
    }
    cancelledIds.push(b.id);
  }

  const cancelledBookings = await prisma.booking.findMany({
    where: { id: { in: cancelledIds } },
    include: { customer: true },
    orderBy: { startsAt: "asc" },
  });

  const base = getSmsLinkBaseUrl();
  const ttlSeconds = emergencyTtlSeconds();
  let smsSent = 0;
  const smsFailures: string[] = [];

  for (const booking of cancelledBookings) {
    try {
      const { shortCode } = await createDeepLinkToken(
        {
          salonId: salon.id,
          phoneE164: booking.customer.phoneE164,
          bookingId: booking.id,
        },
        { ttlSeconds },
      );
      const manageUrl = `${base}/l/${shortCode}`;
      const when = format(booking.startsAt, "yyyy-MM-dd HH:mm");
      const body = `${salon.name}: Cancelled ${when}. Link: ${manageUrl}`;

      await sendBookingSms({ phoneE164: booking.customer.phoneE164, body });
      smsSent += 1;
    } catch (e) {
      smsFailures.push(
        `${booking.customer.phoneE164}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  revalidatePath("/dashboard");
  return {
    ok: true as const,
    cancelled: cancelledIds.length,
    attempted: bookings.length,
    calendarFailures,
    smsSent,
    smsFailures,
  };
}
