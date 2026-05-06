import type { BookingStatus, Prisma } from "@prisma/client";
import { normalizePhone } from "@/lib/phone";

const BOOKING_STATUSES: readonly BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];

/** Customer `where` fragment for booking list phone search. */
export function customerPhoneSearchWhere(
  phoneQuery: string | undefined,
): Prisma.CustomerWhereInput | undefined {
  if (!phoneQuery?.trim()) {
    return undefined;
  }
  const trimmed = phoneQuery.trim();
  try {
    return { phoneE164: normalizePhone(trimmed) };
  } catch {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 3) {
      return { phoneE164: { contains: digits } };
    }
    return undefined;
  }
}

export function parseBookingStatus(value: string | undefined): BookingStatus | undefined {
  if (!value || value === "all") {
    return undefined;
  }
  return BOOKING_STATUSES.includes(value as BookingStatus) ? (value as BookingStatus) : undefined;
}
