import { format } from "date-fns";
import { NextResponse } from "next/server";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { prisma } from "@/lib/prisma";
import { sendBookingSms } from "@/lib/sms";

/** Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual calls can use the same Bearer or `x-reminder-secret`. */
function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const reminderSecret = process.env.REMINDER_DISPATCH_SECRET?.trim();

  if (!cronSecret && !reminderSecret) {
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

async function runDispatch() {
  const now = new Date();
  const reminders = await prisma.bookingReminder.findMany({
    where: { sentAt: null, sendAt: { lte: now } },
    include: {
      booking: {
        include: { staff: true, customer: true, salon: true },
      },
    },
    orderBy: { sendAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    const booking = reminder.booking;
    if (booking.status !== "CONFIRMED" || booking.startsAt <= now) {
      await prisma.bookingReminder.update({
        where: { id: reminder.id },
        data: { sentAt: new Date() },
      });
      skipped += 1;
      continue;
    }

    const token = await createDeepLinkToken({
      salonId: booking.salonId,
      phoneE164: booking.customer.phoneE164,
      bookingId: booking.id,
    });

    const manageUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/r/${token}`;
    const message = `Reminder: your appointment is at ${format(booking.startsAt, "PPP p")} with ${
      booking.staff.name
    }. Manage booking: ${manageUrl}`;

    await sendBookingSms({ phoneE164: booking.customer.phoneE164, body: message });
    await prisma.bookingReminder.update({
      where: { id: reminder.id },
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
  return runDispatch();
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runDispatch();
}
