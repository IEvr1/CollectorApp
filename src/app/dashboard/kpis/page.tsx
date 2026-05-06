import Link from "next/link";
import { ensureSalonSeed } from "@/lib/bootstrap";
import {
  computeAppCustomerStats,
  computeKpis,
  computeMonthlyBookings,
  parsePeriod,
  type KpiRatio,
  type MonthlyBookingBucket,
  type Period,
} from "@/lib/kpis";
import { parseLocale, type Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

const PERIOD_OPTIONS: readonly Period[] = ["today", "7d", "30d", "90d"];

function formatInteger(value: number, lang: Locale): string {
  const locale = lang === "el" ? "el-GR" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; period?: string }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);
  const period = parsePeriod(params.period);

  const t =
    lang === "el"
      ? {
          title: "KPIs",
          subtitle: "Βασικοί δείκτες για τη σαλόνι σας στην επιλεγμένη περίοδο.",
          back: "← Dashboard",
          period: "Περίοδος",
          periods: { today: "Σήμερα", "7d": "7 ημ.", "30d": "30 ημ.", "90d": "90 ημ." },
          range: "Εύρος",
          noSalon: "Δεν υπάρχει salon.",
          completionTitle: "Booking completion rate",
          completionDesc:
            "Από τα ραντεβού της περιόδου που ολοκληρώθηκαν χρονικά, ποσοστό μη-ακυρωμένων.",
          completionBreakdown: (num: number, den: number) =>
            `${num} μη-ακυρωμένα από ${den} ραντεβού στην περίοδο`,
          repeatTitle: "Repeat customer booking rate",
          repeatDesc:
            "Από τις κρατήσεις της περιόδου, ποσοστό από πελάτες με προηγούμενη κράτηση.",
          repeatBreakdown: (num: number, den: number) =>
            `${num} από ${den} κρατήσεις από επιστρέφοντες πελάτες`,
          empty: "—",
          emptyHint: "Δεν υπάρχουν επαρκή δεδομένα για την περίοδο.",
          customersTitle: "Πελάτες εφαρμογής",
          customersDesc:
            "Μοναδικοί πελάτες με τουλάχιστον ένα επιβεβαιωμένο ή ολοκληρωμένο ραντεβού (συνολικά).",
          bookingsLabel: (n: number) =>
            `${formatInteger(n, "el")} ραντεβού (επιβεβαιωμένα / ολοκληρωμένα)`,
          monthlyTitle: "Ραντεβού ανά μήνα",
          monthlyDesc:
            "Τελευταίοι 12 μήνες — κατά μήνα με βάση την ημερομηνία έναρξης του ραντεβού (επιβεβαιωμένα και ολοκληρωμένα).",
          noMonthlyData: "Δεν υπάρχουν ακόμα ραντεβού σε αυτό το διάστημα.",
        }
      : {
          title: "KPIs",
          subtitle: "Key indicators for your salon over the selected period.",
          back: "← Dashboard",
          period: "Period",
          periods: { today: "Today", "7d": "7 d", "30d": "30 d", "90d": "90 d" },
          range: "Range",
          noSalon: "No salon configured.",
          completionTitle: "Booking completion rate",
          completionDesc:
            "Of past bookings in the period, the share that were not cancelled.",
          completionBreakdown: (num: number, den: number) =>
            `${num} non-cancelled out of ${den} past bookings`,
          repeatTitle: "Repeat customer booking rate",
          repeatDesc:
            "Of bookings created in the period, the share from customers with a prior booking.",
          repeatBreakdown: (num: number, den: number) =>
            `${num} of ${den} bookings from returning customers`,
          empty: "—",
          emptyHint: "Not enough data for this period.",
          customersTitle: "App customers",
          customersDesc:
            "Unique customers with at least one confirmed or completed booking (all time).",
          bookingsLabel: (n: number) =>
            `${formatInteger(n, "en")} bookings (confirmed / completed)`,
          monthlyTitle: "Bookings per month",
          monthlyDesc:
            "Last 12 months — by appointment start month (confirmed and completed).",
          noMonthlyData: "No bookings in this window yet.",
        };

  await ensureSalonSeed();
  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-red-600">{t.noSalon}</p>
      </div>
    );
  }

  const [kpis, customerStats, monthly] = await Promise.all([
    computeKpis(salon.id, salon.timezone, period),
    computeAppCustomerStats(salon.id),
    computeMonthlyBookings(salon.id, salon.timezone, 12, lang),
  ]);

  const langSuffix = lang === "en" ? "&lang=en" : "";
  const dashboardHref = `/dashboard${lang === "en" ? "?lang=en" : ""}`;

  const rangeLabel = formatRange(kpis.start, kpis.endExclusive, salon.timezone, lang);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-zinc-600">{t.subtitle}</p>
        </div>
        <Link
          href={dashboardHref}
          className="rounded-xl border border-violet-200 bg-[var(--primary-soft)] px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-800"
        >
          {t.back}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-sm">
        <span className="text-xs font-medium text-zinc-600">{t.period}:</span>
        {PERIOD_OPTIONS.map((p) => {
          const active = p === period;
          const href = `/dashboard/kpis?period=${p}${langSuffix}`;
          return (
            <Link
              key={p}
              href={href}
              className={
                active
                  ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow"
                  : "rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-violet-300 hover:text-violet-700"
              }
            >
              {t.periods[p]}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-zinc-500">
          {t.range}: {rangeLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard
          title={t.completionTitle}
          description={t.completionDesc}
          ratio={kpis.completion}
          breakdown={t.completionBreakdown(kpis.completion.num, kpis.completion.den)}
          empty={t.empty}
          emptyHint={t.emptyHint}
          lang={lang}
        />
        <KpiCard
          title={t.repeatTitle}
          description={t.repeatDesc}
          ratio={kpis.repeat}
          breakdown={t.repeatBreakdown(kpis.repeat.num, kpis.repeat.den)}
          empty={t.empty}
          emptyHint={t.emptyHint}
          lang={lang}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <CustomersCard
            title={t.customersTitle}
            description={t.customersDesc}
            customerCount={customerStats.customers}
            bookingsLine={t.bookingsLabel(customerStats.bookings)}
            lang={lang}
          />
        </div>
        <div className="lg:col-span-8">
          <MonthlyBookingsChart
            title={t.monthlyTitle}
            description={t.monthlyDesc}
            buckets={monthly}
            emptyHint={t.noMonthlyData}
            lang={lang}
          />
        </div>
      </div>
    </div>
  );
}

function CustomersCard({
  title,
  description,
  customerCount,
  bookingsLine,
  lang,
}: {
  title: string;
  description: string;
  customerCount: number;
  bookingsLine: string;
  lang: Locale;
}) {
  const display = formatInteger(customerCount, lang);
  return (
    <section className="flex h-full min-h-[200px] flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        <p className="text-xs text-zinc-500">{description}</p>
      </header>
      <div className="text-4xl font-semibold tracking-tight text-violet-700">{display}</div>
      <p className="text-xs text-zinc-600">{bookingsLine}</p>
    </section>
  );
}

const MONTHLY_CHART_MAX_PX = 168;

function MonthlyBookingsChart({
  title,
  description,
  buckets,
  emptyHint,
  lang,
}: {
  title: string;
  description: string;
  buckets: MonthlyBookingBucket[];
  emptyHint: string;
  lang: Locale;
}) {
  const rawMax = Math.max(0, ...buckets.map((b) => b.count));
  const hasAny = rawMax > 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        <p className="text-xs text-zinc-500">{description}</p>
      </header>

      <div className="relative min-h-[260px]">
        <div className="pointer-events-none absolute inset-x-0 top-8 bottom-[4.5rem] flex flex-col justify-between">
          <div className="border-t border-dashed border-zinc-200/90" />
          <div className="border-t border-dashed border-zinc-200/90" />
          <div className="border-t border-dashed border-zinc-200/90" />
        </div>

        <div className="relative flex h-[220px] gap-1 border-b border-zinc-200 pt-6">
          {buckets.map((b, index) => {
            const barPx =
              !hasAny || b.count === 0
                ? 0
                : Math.max(2, Math.round((b.count / rawMax) * MONTHLY_CHART_MAX_PX));
            const tooltip =
              lang === "el"
                ? `${b.label}: ${b.count} ραντεβού`
                : `${b.label}: ${b.count} bookings`;
            return (
              <div
                key={b.ym}
                className="flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                title={tooltip}
              >
                <div className="flex flex-1 flex-col justify-end gap-1">
                  <span className="h-4 text-center text-[10px] font-medium tabular-nums text-zinc-600">
                    {b.count > 0 ? formatInteger(b.count, lang) : ""}
                  </span>
                  <div className="flex h-[168px] w-full flex-col justify-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 shadow-sm transition hover:from-violet-700 hover:to-violet-500"
                      style={{
                        height: `${barPx}px`,
                      }}
                    />
                  </div>
                </div>
                <span
                  className={`mt-2 block max-w-full truncate text-center text-[9px] leading-tight text-zinc-500 ${
                    index % 2 !== 0 ? "hidden sm:block" : ""
                  }`}
                >
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>

        {!hasAny ? <p className="mt-3 text-xs text-zinc-500">{emptyHint}</p> : null}
      </div>
    </section>
  );
}

function KpiCard({
  title,
  description,
  ratio,
  breakdown,
  empty,
  emptyHint,
  lang,
}: {
  title: string;
  description: string;
  ratio: KpiRatio;
  breakdown: string;
  empty: string;
  emptyHint: string;
  lang: Locale;
}) {
  const hasData = ratio.rate !== null;
  const percent = hasData ? formatPercent(ratio.rate as number, lang) : empty;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        <p className="text-xs text-zinc-500">{description}</p>
      </header>
      <div className="text-4xl font-semibold tracking-tight text-violet-700">{percent}</div>
      <p className="text-xs text-zinc-600">{hasData ? breakdown : emptyHint}</p>
    </section>
  );
}

function formatPercent(value: number, lang: Locale): string {
  const locale = lang === "el" ? "el-GR" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRange(start: Date, endExclusive: Date, timeZone: string, lang: Locale): string {
  const locale = lang === "el" ? "el-GR" : "en-US";
  const dateFmt = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const inclusiveEnd = new Date(endExclusive.getTime() - 1);
  return `${dateFmt.format(start)} – ${dateFmt.format(inclusiveEnd)}`;
}
