import { format } from "date-fns";
import { NextResponse } from "next/server";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { prisma } from "@/lib/prisma";
import { sendBookingSms } from "@/lib/sms";
import { getSmsLinkBaseUrl } from "@/lib/sms-link-base";

// Vercel cron is UTC-only; this keeps the daily run from missing 07:30 local reminders around DST.
const DISPATCH_LOOKAHEAD_MS = 90 * 60 * 1000;

/** Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual calls can use the same Bearer or `x-reminder-secret`. */
function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const reminderSecret = process.env.REMINDER_DISPATCH_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !reminderSecret) {
    return false;
  }

  if (!isProd && !cronSecret && !reminderSecret) {
    return true;
  }

  const auth = request.headers.get("authorization")?.trim();
  const bearerMatch = auth?.match(/^Bearer\s+(.+)$/i);
  const bearer = bearerMatch?.[1]?.trim();

  if (cronSecret && bearer === cronSecret) {
    return true;
  }
  if (reminderSecret && bearer === reminderSecret) {
    return true;
  }
  if (reminderSecret) {
    const headerSecret = request.headers.get("x-reminder-secret");
    if (headerSecret === reminderSecret) {
      return true;
    }
  }

  return false;
}

async function runDispatch(request: Request) {
  const now = new Date();
  const dispatchThrough = new Date(now.getTime() + DISPATCH_LOOKAHEAD_MS);
  const reminders = await prisma.bookingReminder.findMany({
    where: { sentAt: null, sendAt: { lte: dispatchThrough } },
    include: {
      booking: {
        include: { customer: true, salon: true },
      },
    },
    orderBy: { sendAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let skipped = 0;
  const processedBookingIds = new Set<string>();

  for (const reminder of reminders) {
    const booking = reminder.booking;
    if (processedBookingIds.has(booking.id)) {
      continue;
    }
    processedBookingIds.add(booking.id);

    if (booking.status !== "CONFIRMED" || booking.startsAt <= now) {
      await prisma.bookingReminder.updateMany({
        where: { bookingId: booking.id, sentAt: null, sendAt: { lte: dispatchThrough } },
        data: { sentAt: new Date() },
      });
      skipped += 1;
      continue;
    }

    const { shortCode } = await createDeepLinkToken({
      salonId: booking.salonId,
      phoneE164: booking.customer.phoneE164,
      bookingId: booking.id,
    });

    const base = getSmsLinkBaseUrl(request);
    const manageUrl = `${base}/l/${shortCode}`;
    const when = format(booking.startsAt, "yyyy-MM-dd HH:mm");
    const message = `${booking.salon.name}: Reminder ${when}. Manage Booking: ${manageUrl}`;

    await sendBookingSms({ phoneE164: booking.customer.phoneE164, body: message });
    await prisma.bookingReminder.updateMany({
      where: { bookingId: booking.id, sentAt: null, sendAt: { lte: dispatchThrough } },
      data: { sentAt: new Date() },
    });
    sent += 1;
  }

  return NextResponse.json({ processed: reminders.length, sent, skipped });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDispatch(request);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDispatch(request);
}
