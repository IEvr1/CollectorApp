import { subHours, subMinutes } from "date-fns";
import { prisma } from "@/lib/prisma";

const REMINDER_24HOURS_MS = 24 * 60 * 60 * 1000;
const REMINDER_2H30_MS = (2 * 60 + 30) * 60 * 1000;

export function computeReminderTimes(startsAt: Date, now = new Date()) {
  const leadTimeMs = startsAt.getTime() - now.getTime();

  if (leadTimeMs < REMINDER_2H30_MS) {
    return [];
  }

  const reminders = [subMinutes(startsAt, 150)];
  if (leadTimeMs >= REMINDER_24HOURS_MS) {
    reminders.unshift(subHours(startsAt, 24));
  }

  return reminders;
}

export async function scheduleBookingReminders(params: { bookingId: string; startsAt: Date }) {
  const reminderTimes = computeReminderTimes(params.startsAt);
  if (reminderTimes.length === 0) {
    return;
  }

  await prisma.bookingReminder.createMany({
    data: reminderTimes.map((sendAt) => ({ bookingId: params.bookingId, sendAt })),
  });
}
