import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { customerPhoneSearchWhere, parseBookingStatus } from "@/lib/dashboard-query";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { salonLocalDayBoundsUtc, todayIsoInTimeZone } from "@/lib/timezone";
import { DashboardClosuresPanel } from "@/app/dashboard/dashboard-closures-panel";
import { DashboardEmergencyPanel } from "@/app/dashboard/dashboard-emergency-panel";
import { DashboardFilters } from "@/app/dashboard/dashboard-filters";
import { DashboardBookingsView } from "@/app/dashboard/dashboard-bookings-view";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    lang?: string;
    date?: string;
    staffId?: string;
    serviceId?: string;
    status?: string;
    phone?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);

  const t =
    lang === "el"
      ? {
          title: "Dashboard Διαχείρισης",
          subtitle: "Φίλτρα ανά ημέρα (ζώνη salon), staff, υπηρεσία, κατάσταση και τηλέφωνο.",
          dt: "Ημερομηνία & Ώρα",
          customer: "Πελάτης",
          phone: "Τηλέφωνο",
          service: "Υπηρεσία",
          staff: "Staff",
          status: "Κατάσταση",
          actionsColumn: "Ενέργειες",
          empty: "Δεν βρέθηκαν ραντεβού για τα κριτήρια.",
          filters: {
            date: "Ημέρα",
            staff: "Staff",
            service: "Υπηρεσία",
            status: "Κατάσταση",
            phone: "Τηλέφωνο",
            view: "Προβολή",
            list: "Λίστα",
            grouped: "Ανά staff",
            all: "Όλα",
            apply: "Εφαρμογή",
          },
          actionBtns: {
            cancel: "Ακύρωση",
            reschedule: "Αλλαγή ώρας",
            confirmCancel: "Να ακυρωθεί αυτό το ραντεβού;",
            loadSlots: "Φόρτωση διαθέσιμων ωρών",
            pickSlot: "Επιλέξτε ώρα:",
            close: "Κλείσιμο",
            working: "Περιμένετε…",
            errorPrefix: "",
          },
          mutationsOff:
            "Οι ενέργειες ακύρωσης/αλλαγής ώρας είναι απενεργοποιημένες μέχρι να οριστεί DASHBOARD_AUTH_SECRET (Basic auth).",
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
          closures: {
            title: "Κλειστές ημέρες / αργίες",
            subtitle:
              "Ημερολογιακές ημέρες σε ζώνη salon όπου δεν εμφανίζονται διαθέσιμες ώρες και δεν γίνονται νέες κρατήσεις.",
            from: "Από",
            to: "Έως (συμπεριλαμβανομένης)",
            note: "Σημείωση (προαιρετικά)",
            add: "Προσθήκη",
            delete: "Διαγραφή",
            empty: "Δεν έχουν οριστεί κλειστές περίοδοι.",
            working: "Περιμένετε…",
            listHeading: "Καταχωρημένες περίοδοι",
          },
        }
      : {
          title: "Manager Dashboard",
          subtitle: "Filters by salon-local day, staff, service, status, and phone.",
          dt: "Date & Time",
          customer: "Customer",
          phone: "Phone",
          service: "Service",
          staff: "Staff",
          status: "Status",
          actionsColumn: "Actions",
          empty: "No bookings match your filters.",
          filters: {
            date: "Day",
            staff: "Staff",
            service: "Service",
            status: "Status",
            phone: "Phone",
            view: "Layout",
            list: "List",
            grouped: "By staff",
            all: "All",
            apply: "Apply",
          },
          actionBtns: {
            cancel: "Cancel",
            reschedule: "Reschedule",
            confirmCancel: "Cancel this appointment?",
            loadSlots: "Load available times",
            pickSlot: "Pick a time:",
            close: "Close",
            working: "Please wait…",
            errorPrefix: "",
          },
          mutationsOff:
            "Cancel and reschedule are disabled until DASHBOARD_AUTH_SECRET is set (Basic auth).",
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
          closures: {
            title: "Closed days / holidays",
            subtitle:
              "Salon-local calendar dates with no available slots and no new bookings (inclusive end date).",
            from: "From",
            to: "To (inclusive)",
            note: "Note (optional)",
            add: "Add",
            delete: "Delete",
            empty: "No closure periods defined.",
            working: "Please wait…",
            listHeading: "Saved periods",
          },
        };

  await ensureSalonSeed();

  const salon = await prisma.salon.findFirst();
  if (!salon) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm text-red-600">{lang === "el" ? "Δεν υπάρχει salon." : "No salon configured."}</p>
      </div>
    );
  }

  const todayStr = todayIsoInTimeZone(salon.timezone);
  const dateParam = params.date?.trim();
  const dateStr = dateParam && ISO_DATE.test(dateParam) ? dateParam : todayStr;

  const { start, endExclusive } = salonLocalDayBoundsUtc(dateStr, salon.timezone);

  const staffId = params.staffId?.trim() || "";
  const serviceId = params.serviceId?.trim() || "";
  const statusParsed = parseBookingStatus(params.status?.trim());
  const phoneQ = params.phone?.trim() || "";
  const phoneWhere = customerPhoneSearchWhere(phoneQ || undefined);

  const view: "list" | "grouped" = params.view === "list" ? "list" : "grouped";

  const where: Prisma.BookingWhereInput = {
    salonId: salon.id,
    startsAt: { gte: start, lt: endExclusive },
    ...(staffId ? { staffId } : {}),
    ...(serviceId ? { serviceId } : {}),
    ...(statusParsed ? { status: statusParsed } : {}),
    ...(phoneWhere ? { customer: phoneWhere } : {}),
  };

  const [staffOptions, serviceOptions, bookings, emergencyDayCount, closures] = await Promise.all([
    prisma.staff.findMany({
      where: { salonId: salon.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { salonId: salon.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: 500,
      include: { customer: true, service: true, staff: true },
    }),
    prisma.booking.count({
      where: {
        salonId: salon.id,
        startsAt: { gte: start, lt: endExclusive },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    }),
    prisma.salonClosure.findMany({
      where: { salonId: salon.id },
      orderBy: { startDate: "asc" },
      select: { id: true, startDate: true, endDate: true, label: true },
    }),
  ]);

  const mutationsAllowed = Boolean(process.env.DASHBOARD_AUTH_SECRET?.trim());

  const dateFnsLocale = lang === "el" ? el : enGB;
  const dateLabel = format(new Date(`${dateStr}T12:00:00`), "PPP", { locale: dateFnsLocale });
  const dayExplanation =
    lang === "el"
      ? `Για την ${dateLabel} υπάρχουν ${emergencyDayCount} ενεργά ραντεβού (PENDING/CONFIRMED) σε όλο το salon, ανεξάρτητα από τα φίλτρα του πίνακα. Θα ακυρωθούν όλα και θα σταλεί SMS σε κάθε πελάτη με σύνδεσμο επαναπρογραμματισμού.`
      : `On ${dateLabel} there are ${emergencyDayCount} active bookings (PENDING/CONFIRMED) for the entire salon, independent of table filters. All will be cancelled and each customer receives an SMS with a reschedule link.`;

  const kpisHref = `/dashboard/kpis${lang === "en" ? "?lang=en" : ""}`;
  const kpisLabel = lang === "el" ? "KPIs" : "KPIs";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-zinc-600">{t.subtitle}</p>
        </div>
        <Link
          href={kpisHref}
          className="rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-violet-700"
        >
          {kpisLabel}
        </Link>
      </div>
      {!mutationsAllowed ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.mutationsOff}
        </p>
      ) : null}

      <DashboardFilters
        lang={lang}
        staff={staffOptions}
        services={serviceOptions}
        values={{
          date: dateStr,
          staffId,
          serviceId,
          status: statusParsed ?? "all",
          phone: phoneQ,
          view,
        }}
        labels={t.filters}
      />

      <DashboardClosuresPanel lang={lang} closures={closures} mutationsAllowed={mutationsAllowed} labels={t.closures} />

      <DashboardEmergencyPanel
        lang={lang}
        filterDate={dateStr}
        activeDayCount={emergencyDayCount}
        mutationsAllowed={mutationsAllowed}
        labels={{ ...t.emergency, dayExplanation }}
      />

      <DashboardBookingsView
        bookings={bookings}
        view={view}
        lang={lang}
        filterDate={dateStr}
        tableLabels={{
          dt: t.dt,
          customer: t.customer,
          phone: t.phone,
          service: t.service,
          staff: t.staff,
          status: t.status,
          actions: t.actionsColumn,
          empty: t.empty,
        }}
        actionLabels={t.actionBtns}
      />
    </div>
  );
}
