import type { Prisma } from "@prisma/client";
import type { Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import {
  isoDateInTimeZone,
  salonLocalDayBoundsUtc,
  salonLocalMonthBoundsUtc,
  todayIsoInTimeZone,
  zonedWallTimeToUtc,
} from "@/lib/timezone";

export type Period = "today" | "7d" | "30d" | "90d";

const PERIODS: readonly Period[] = ["today", "7d", "30d", "90d"];

const PERIOD_DAYS: Record<Period, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function parsePeriod(value: string | undefined | null): Period {
  if (value && (PERIODS as readonly string[]).includes(value)) {
    return value as Period;
  }
  return "30d";
}

/**
 * UTC bounds for a rolling salon-local window ending at the end of today.
 * Anchors on local noon when stepping back so DST transitions do not skew the count.
 */
export function periodBoundsUtc(
  period: Period,
  timezone: string,
  now: Date = new Date(),
): { start: Date; endExclusive: Date } {
  const todayIso = todayIsoInTimeZone(timezone, now);
  const days = PERIOD_DAYS[period];

  const todayBounds = salonLocalDayBoundsUtc(todayIso, timezone);
  const endExclusive = todayBounds.endExclusive;

  if (days <= 1) {
    return { start: todayBounds.start, endExclusive };
  }

  const todayNoon = zonedWallTimeToUtc(todayIso, 12, 0, 0, timezone);
  const earlierInstant = new Date(todayNoon.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const startIso = todayIsoInTimeZone(timezone, earlierInstant);
  const start = zonedWallTimeToUtc(startIso, 0, 0, 0, timezone);

  return { start, endExclusive };
}

export type KpiRatio = {
  num: number;
  den: number;
  rate: number | null;
};

export type Kpis = {
  period: Period;
  start: Date;
  endExclusive: Date;
  completion: KpiRatio;
  repeat: KpiRatio;
};

/**
 * Compute the two MVP KPIs for a salon over a rolling period:
 *  - completion: of bookings that should have happened (startsAt in period, endsAt < now,
 *    status ∈ {CONFIRMED, COMPLETED, CANCELLED}), the share that were not cancelled.
 *  - repeat: of bookings created in period, the share whose customer had an earlier booking.
 */
export async function computeKpis(
  salonId: string,
  timezone: string,
  period: Period,
  now: Date = new Date(),
): Promise<Kpis> {
  const { start, endExclusive } = periodBoundsUtc(period, timezone, now);

  const completionWhere: Prisma.BookingWhereInput = {
    salonId,
    startsAt: { gte: start, lt: endExclusive },
    endsAt: { lt: now },
    status: { in: ["CONFIRMED", "COMPLETED", "CANCELLED"] },
  };

  const [completionDen, completionNum, periodBookings] = await Promise.all([
    prisma.booking.count({ where: completionWhere }),
    prisma.booking.count({
      where: {
        ...completionWhere,
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    }),
    prisma.booking.findMany({
      where: {
        salonId,
        createdAt: { gte: start, lt: endExclusive },
      },
      select: { id: true, customerId: true, createdAt: true },
    }),
  ]);

  let repeatNum = 0;
  const repeatDen = periodBookings.length;

  if (repeatDen > 0) {
    const customerIds = Array.from(new Set(periodBookings.map((b) => b.customerId)));
    const firstByCustomer = await prisma.booking.groupBy({
      by: ["customerId"],
      where: { salonId, customerId: { in: customerIds } },
      _min: { createdAt: true },
    });
    const firstMap = new Map<string, Date>();
    for (const row of firstByCustomer) {
      if (row._min.createdAt) {
        firstMap.set(row.customerId, row._min.createdAt);
      }
    }
    for (const b of periodBookings) {
      const first = firstMap.get(b.customerId);
      if (first && b.createdAt.getTime() > first.getTime()) {
        repeatNum += 1;
      }
    }
  }

  return {
    period,
    start,
    endExclusive,
    completion: {
      num: completionNum,
      den: completionDen,
      rate: completionDen === 0 ? null : completionNum / completionDen,
    },
    repeat: {
      num: repeatNum,
      den: repeatDen,
      rate: repeatDen === 0 ? null : repeatNum / repeatDen,
    },
  };
}

const CONFIRMED_OR_COMPLETED = ["CONFIRMED", "COMPLETED"] as const;

/**
 * Lifetime counts: unique customers with at least one CONFIRMED/COMPLETED booking,
 * and total CONFIRMED/COMPLETED bookings (app channel — all bookings originate from the app).
 */
export async function computeAppCustomerStats(
  salonId: string,
): Promise<{ customers: number; bookings: number }> {
  const [distinctRows, bookings] = await Promise.all([
    prisma.booking.findMany({
      where: { salonId, status: { in: [...CONFIRMED_OR_COMPLETED] } },
      distinct: ["customerId"],
      select: { customerId: true },
    }),
    prisma.booking.count({
      where: { salonId, status: { in: [...CONFIRMED_OR_COMPLETED] } },
    }),
  ]);
  return { customers: distinctRows.length, bookings };
}

export type MonthlyBookingBucket = {
  ym: string;
  label: string;
  count: number;
};

function formatMonthBarLabel(ym: string, timezone: string, lang: Locale): string {
  const ymParts = ym.split("-");
  const y = Number(ymParts[0]);
  const mo = Number(ymParts[1]);
  if (!y || !mo || mo < 1 || mo > 12) {
    return ym;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoDate = `${y}-${pad(mo)}-15`;
  const instant = zonedWallTimeToUtc(isoDate, 12, 0, 0, timezone);
  const locale = lang === "el" ? "el-GR" : "en-US";
  const dateParts = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: "short",
    year: "2-digit",
  }).formatToParts(instant);
  const month = dateParts.find((part) => part.type === "month")?.value.replace(/\.$/, "");
  const year = dateParts.find((part) => part.type === "year")?.value;

  if (!month || !year) {
    return ym;
  }
  return `${month}-${year}`;
}

/**
 * Rolling last `monthsBack` salon-local months (ending at current month), counting bookings whose
 * `startsAt` falls in each month (CONFIRMED + COMPLETED only).
 */
export async function computeMonthlyBookings(
  salonId: string,
  timezone: string,
  monthsBack: number,
  lang: Locale,
  now: Date = new Date(),
): Promise<MonthlyBookingBucket[]> {
  const iso = isoDateInTimeZone(now, timezone);
  const endYear = Number(iso.slice(0, 4));
  const endMonth = Number(iso.slice(5, 7));
  if (!endYear || !endMonth) {
    throw new Error("Could not parse salon-local date for monthly KPIs");
  }

  const monthList: Array<{ y: number; m: number; ym: string }> = [];
  let cy = endYear;
  let cm = endMonth;
  for (let i = 0; i < monthsBack; i += 1) {
    monthList.unshift({
      y: cy,
      m: cm,
      ym: `${cy}-${String(cm).padStart(2, "0")}`,
    });
    cm -= 1;
    if (cm < 1) {
      cm = 12;
      cy -= 1;
    }
  }

  const oldest = monthList[0];
  const newest = monthList[monthList.length - 1];
  if (!oldest || !newest) {
    return [];
  }

  const { start: rangeStart } = salonLocalMonthBoundsUtc(oldest.y, oldest.m, timezone);
  const { endExclusive: rangeEnd } = salonLocalMonthBoundsUtc(newest.y, newest.m, timezone);

  const rows = await prisma.booking.findMany({
    where: {
      salonId,
      status: { in: [...CONFIRMED_OR_COMPLETED] },
      startsAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: { startsAt: true },
  });

  const counts = new Map<string, number>();
  for (const row of monthList) {
    counts.set(row.ym, 0);
  }
  for (const row of rows) {
    const localDate = isoDateInTimeZone(row.startsAt, timezone);
    const ym = localDate.slice(0, 7);
    if (counts.has(ym)) {
      counts.set(ym, (counts.get(ym) ?? 0) + 1);
    }
  }

  return monthList.map((row) => ({
    ym: row.ym,
    label: formatMonthBarLabel(row.ym, timezone, lang),
    count: counts.get(row.ym) ?? 0,
  }));
}
