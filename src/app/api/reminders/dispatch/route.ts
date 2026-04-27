import { format } from "date-fns";
import { NextResponse } from "next/server";
import { createDeepLinkToken } from "@/lib/deep-link-token";
import { prisma } from "@/lib/prisma";
import { sendBookingSms } from "@/lib/sms";

function isAuthorized(request: Request) {
  const expectedSecret = process.env.REMINDER_DISPATCH_SECRET;
  if (!expectedSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-reminder-secret");
  return headerSecret === expectedSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
