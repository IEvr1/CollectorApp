/**
 * Convert a calendar date + wall clock time in a given IANA timezone to a UTC Date.
 * Uses Intl iteration (no extra deps) so server TZ does not affect salon-local days.
 */
export function zonedWallTimeToUtc(
  isoDate: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [y, m, d] = isoDate.split("-").map((v) => Number(v));
  if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    throw new Error("Invalid date string (expected YYYY-MM-DD)");
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  function readParts(instant: Date) {
    const parts = formatter.formatToParts(instant);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") {
        map[p.type] = Number(p.value);
      }
    }
    return map;
  }

  let guess = new Date(Date.UTC(y, m - 1, d, hour, minute, second, 0));

  for (let i = 0; i < 24; i += 1) {
    const got = readParts(guess);
    const targetUtc = Date.UTC(y, m - 1, d, hour, minute, second);
    const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const drift = targetUtc - gotUtc;
    if (drift === 0) {
      return guess;
    }
    guess = new Date(guess.getTime() + drift);
  }

  throw new Error(`Could not resolve wall time in timezone ${timeZone}`);
}

/** Weekday 0–6 (Sunday–Saturday) for the given calendar date in the timezone. */
export function weekdayInTimeZone(isoDate: string, timeZone: string): number {
  const noon = zonedWallTimeToUtc(isoDate, 12, 0, 0, timeZone);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const n = map[wd as keyof typeof map];
  if (n === undefined) {
    throw new Error("Unexpected weekday from Intl");
  }
  return n;
}
