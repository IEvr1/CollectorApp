import { prisma } from "@/lib/prisma";
import { isoDateInTimeZone, zonedWallTimeToUtc } from "@/lib/timezone";

const REMINDER_HOUR = 7;
const REMINDER_MINUTE = 30;

export function computeReminderTimes(startsAt: Date, timeZone: string, now = new Date()) {
  const appointmentDate = isoDateInTimeZone(startsAt, timeZone);
  const reminders = [zonedWallTimeToUtc(appointmentDate, REMINDER_HOUR, REMINDER_MINUTE, 0, timeZone)];

  return reminders.filter((sendAt) => sendAt > now && sendAt < startsAt);
}

export async function scheduleBookingReminders(params: { bookingId: string; startsAt: Date; timeZone: string }) {
  const reminderTimes = computeReminderTimes(params.startsAt, params.timeZone);
  if (reminderTimes.length === 0) {
    return;
  }

  await prisma.bookingReminder.createMany({
    data: reminderTimes.map((sendAt) => ({ bookingId: params.bookingId, sendAt })),
  });
}
