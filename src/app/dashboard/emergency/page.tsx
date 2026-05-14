import Link from "next/link";
import { format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { isDashboardLinkAuthAvailable } from "@/lib/dashboard-auth";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { salonLocalDayBoundsUtc, todayIsoInTimeZone } from "@/lib/timezone";
import { DashboardEmergencyPanel } from "@/app/dashboard/dashboard-emergency-panel";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardEmergencyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; date?: string }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);
  const t =
    lang === "el"
      ? {
          title: "Έκτακτη ακύρωση ημέρας",
          subtitle: "Ακυρώστε μαζικά όλα τα ενεργά ραντεβού μιας ημέρας και στείλτε SMS επαναπρογραμματισμού.",
          back: "← Dashboard",
          noSalon: "Δεν υπάρχει salon.",
          day: "Ημέρα",
          refresh: "Ενημέρωση",
          mutationsOff:
            "Η έκτακτη ακύρωση είναι απενεργοποιημένη μέχρι να οριστεί DASHBOARD_LINK_SECRET.",
          emergency: {
            button: "Έκτακτη ακύρωση ημέρας…",
            step1Title: "Έκτακτη ακύρωση όλων των ραντεβού της ημέρας",
            step1Continue: "Συνέχεια",
            step1Back: "Άκυρο",
            step2Title: "Οριστική επιβεβαίωση",
            step2Checkbox:
              "Καταλαβαίνω ότι όλα τα ενεργά ραντεβού (PENDING/CONFIRMED) της επιλεγμένης ημέρας για όλο το salon θα ακυρωθούν και θα σταλεί SMS στους πελάτες.",
            step2Placeholder: "ΑΚΥΡΩΣΗ",
            step2Hint: "Πληκτρολογήστε ΑΚΥΡΩΣΗ για επιβεβαίωση:",
            step2Execute: "Εκτέλεση",
            step2Back: "Πίσω",
            working: "Περιμένετε…",
            resultTitle: "Αποτέλεσμα",
            resultCancelled: "Επιτυχείς ακυρώσεις",
            resultAttempted: "Σύνολο που βρέθηκαν",
            resultSmsSent: "SMS που στάλθηκαν",
            resultSmsFailures: "Αποτυχίες SMS",
            resultCalendarFailures: "Αποτυχίες ημερολογίου Google",
            close: "Κλείσιμο",
          },
        }
      : {
          title: "Emergency cancel day",
          subtitle: "Bulk-cancel every active booking for a day and send reschedule SMS messages.",
          back: "← Dashboard",
          noSalon: "No salon configured.",
          day: "Day",
          refresh: "Refresh",
          mutationsOff: "Emergency cancellation is disabled until DASHBOARD_LINK_SECRET is set.",
          emergency: {
            button: "Emergency cancel day…",
            step1Title: "Emergency cancel all appointments for this day",
            step1Continue: "Continue",
            step1Back: "Cancel",
            step2Title: "Final confirmation",
            step2Checkbox:
              "I understand that every active booking (PENDING/CONFIRMED) on the selected salon-local day for the whole salon will be cancelled and customers will receive an SMS.",
            step2Placeholder: "CANCEL",
            step2Hint: "Type CANCEL to confirm:",
            step2Execute: "Execute",
            step2Back: "Back",
            working: "Please wait…",
            resultTitle: "Result",
            resultCancelled: "Successful cancellations",
            resultAttempted: "Bookings found",
            resultSmsSent: "SMS sent",
            resultSmsFailures: "SMS failures",
            resultCalendarFailures: "Google Calendar failures",
            close: "Close",
          },
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

  const todayStr = todayIsoInTimeZone(salon.timezone);
  const dateParam = params.date?.trim();
  const dateStr = dateParam && ISO_DATE.test(dateParam) ? dateParam : todayStr;
  const { start, endExclusive } = salonLocalDayBoundsUtc(dateStr, salon.timezone);
  const activeDayCount = await prisma.booking.count({
    where: {
      salonId: salon.id,
      startsAt: { gte: start, lt: endExclusive },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  const mutationsAllowed = isDashboardLinkAuthAvailable();
  const dateFnsLocale = lang === "el" ? el : enGB;
  const dateLabel = format(new Date(`${dateStr}T12:00:00`), "PPP", { locale: dateFnsLocale });
  const dayExplanation =
    lang === "el"
      ? `Για την ${dateLabel} υπάρχουν ${activeDayCount} ενεργά ραντεβού (PENDING/CONFIRMED) σε όλο το salon. Θα ακυρωθούν όλα και θα σταλεί SMS σε κάθε πελάτη με σύνδεσμο επαναπρογραμματισμού.`
      : `On ${dateLabel} there are ${activeDayCount} active bookings (PENDING/CONFIRMED) for the entire salon. All will be cancelled and each customer receives an SMS with a reschedule link.`;
  const dashboardHref = `/dashboard${lang === "en" ? "?lang=en" : ""}`;

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

      {!mutationsAllowed ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.mutationsOff}
        </p>
      ) : null}

      <form className="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm sm:flex-row sm:items-end">
        {lang === "en" ? <input type="hidden" name="lang" value="en" /> : null}
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-zinc-600">
          {t.day}
          <input
            type="date"
            name="date"
            defaultValue={dateStr}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-violet-700"
        >
          {t.refresh}
        </button>
      </form>

      <DashboardEmergencyPanel
        lang={lang}
        filterDate={dateStr}
        activeDayCount={activeDayCount}
        mutationsAllowed={mutationsAllowed}
        labels={{ ...t.emergency, dayExplanation }}
      />
    </div>
  );
}
