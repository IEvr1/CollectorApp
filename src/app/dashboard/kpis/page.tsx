import Link from "next/link";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { computeKpis, parsePeriod, type KpiRatio, type Period } from "@/lib/kpis";
import { parseLocale, type Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

const PERIOD_OPTIONS: readonly Period[] = ["today", "7d", "30d", "90d"];

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

  const kpis = await computeKpis(salon.id, salon.timezone, period);

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
    </div>
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
