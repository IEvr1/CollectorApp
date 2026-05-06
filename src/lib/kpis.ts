import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  salonLocalDayBoundsUtc,
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
