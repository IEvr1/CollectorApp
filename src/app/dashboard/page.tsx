import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { customerPhoneSearchWhere, parseBookingStatus } from "@/lib/dashboard-query";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { salonLocalDayBoundsUtc, todayIsoInTimeZone } from "@/lib/timezone";
import { DashboardFilters } from "@/app/dashboard/dashboard-filters";
import { DashboardBookingsView } from "@/app/dashboard/dashboard-bookings-view";
import { isDashboardLinkAuthAvailable } from "@/lib/dashboard-auth";

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
            "Οι ενέργειες ακύρωσης/αλλαγής ώρας είναι απενεργοποιημένες μέχρι να οριστεί DASHBOARD_LINK_SECRET.",
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
            "Cancel and reschedule are disabled until DASHBOARD_LINK_SECRET is set.",
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

  const [staffOptions, serviceOptions, bookings] = await Promise.all([
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
  ]);

  const mutationsAllowed = isDashboardLinkAuthAvailable();

  const kpisHref = `/dashboard/kpis${lang === "en" ? "?lang=en" : ""}`;
  const closuresHref = `/dashboard/closures${lang === "en" ? "?lang=en" : ""}`;
  const emergencyHref = `/dashboard/emergency?date=${dateStr}${lang === "en" ? "&lang=en" : ""}`;
  const navCards = [
    {
      href: kpisHref,
      title: "KPIs",
      description: lang === "el" ? "Στατιστικά και δείκτες απόδοσης." : "Performance stats and indicators.",
    },
    {
      href: closuresHref,
      title: lang === "el" ? "Κλειστές ημέρες / αργίες" : "Closed days / holidays",
      description: lang === "el" ? "Διαχείριση ημερών χωρίς διαθέσιμες ώρες." : "Manage days with no available slots.",
    },
    {
      href: emergencyHref,
      title: lang === "el" ? "Έκτακτη ακύρωση ημέρας" : "Emergency cancel day",
      description:
        lang === "el"
          ? "Μαζική ακύρωση ενεργών ραντεβού για επιλεγμένη ημέρα."
          : "Bulk-cancel active bookings for a selected day.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-sm text-zinc-600">{t.subtitle}</p>
        </div>
      </div>
      {!mutationsAllowed ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.mutationsOff}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {navCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
          >
            <span className="text-sm font-semibold text-violet-800">{card.title}</span>
            <span className="mt-1 block text-xs leading-5 text-zinc-600">{card.description}</span>
          </Link>
        ))}
      </div>

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
