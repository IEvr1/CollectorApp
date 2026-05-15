import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { customerPhoneSearchWhere, parseBookingStatus } from "@/lib/dashboard-query";
import { listGoogleCalendarEvents, resolveGoogleCalendarId } from "@/lib/google-calendar";
import { parseLocale, type Locale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { salonLocalDayBoundsUtc, todayIsoInTimeZone } from "@/lib/timezone";
import { DashboardFilters } from "@/app/dashboard/dashboard-filters";
import {
  DashboardBookingsView,
  type DashboardBookingRow,
} from "@/app/dashboard/dashboard-bookings-view";
import { DashboardPwaInstall } from "@/app/dashboard/dashboard-pwa-install";
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
          title: "Dashboard",
          date: "Ημερομηνία",
          time: "Ώρα",
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
            requestSent: "Στάλθηκε SMS",
            calendarOnlyMissingPhone: "Χωρίς τηλέφωνο",
          },
          mutationsOff:
            "Οι ενέργειες ακύρωσης/αλλαγής ώρας είναι απενεργοποιημένες μέχρι να οριστεί DASHBOARD_LINK_SECRET.",
          nav: {
            newBooking: "Καταχώρηση Ραντεβού",
            holidays: "Αργίες",
            emergency: "Ακύρωση",
            install: "Εγκατάσταση",
          },
        }
      : {
          title: "Dashboard",
          date: "Date",
          time: "Time",
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
            requestSent: "SMS sent",
            calendarOnlyMissingPhone: "No phone",
          },
          mutationsOff:
            "Cancel and reschedule are disabled until DASHBOARD_LINK_SECRET is set.",
          nav: {
            newBooking: "Add Booking",
            holidays: "Holidays",
            emergency: "Cancel",
            install: "Install app",
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
  const dashboardTitle = `${t.title} ${salon.name}`;

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
      select: { id: true, name: true, calendarId: true },
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
  const persistedGoogleEventIds = new Set(
    bookings.map((booking) => booking.googleEventId).filter((id): id is string => Boolean(id)),
  );
  const calendarRows = await loadCalendarOnlyRows({
    staff: staffOptions,
    start,
    endExclusive,
    selectedStaffId: staffId,
    selectedServiceId: serviceId,
    selectedServiceName: serviceOptions.find((service) => service.id === serviceId)?.name ?? "",
    statusFiltered: Boolean(statusParsed),
    phoneQuery: phoneQ,
    persistedGoogleEventIds,
  });
  const dashboardRows: DashboardBookingRow[] = [...bookings, ...calendarRows].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  const mutationsAllowed = isDashboardLinkAuthAvailable();

  const newBookingHref = `/chat?lang=${lang}`;
  const kpisHref = `/dashboard/kpis${lang === "en" ? "?lang=en" : ""}`;
  const closuresHref = `/dashboard/closures${lang === "en" ? "?lang=en" : ""}`;
  const emergencyHref = `/dashboard/emergency?date=${dateStr}${lang === "en" ? "&lang=en" : ""}`;
  const navButtons = [
    { href: newBookingHref, label: t.nav.newBooking, openInNewWindow: true },
    { href: kpisHref, label: "KPIs" },
    { href: closuresHref, label: t.nav.holidays },
    { href: emergencyHref, label: t.nav.emergency },
  ];
  const commonDashboardQuery = {
    date: dateStr,
    staffId,
    serviceId,
    status: statusParsed ?? "",
    phone: phoneQ,
    view,
  };
  const greekHref = dashboardHref({ ...commonDashboardQuery, lang: "el" });
  const englishHref = dashboardHref({ ...commonDashboardQuery, lang: "en" });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{dashboardTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DashboardPwaInstall label={t.nav.install} />
          {navButtons.map((button) => (
            <Link
              key={button.href}
              href={button.href}
              target={button.openInNewWindow ? "_blank" : undefined}
              rel={button.openInNewWindow ? "noreferrer" : undefined}
              className="rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-violet-700"
            >
              {button.label}
            </Link>
          ))}
          <div className="flex rounded-xl border border-zinc-200 bg-white/90 p-1 text-xs font-medium shadow-sm">
            <Link
              href={greekHref}
              className={
                lang === "el"
                  ? "rounded-lg bg-violet-600 px-2.5 py-1 text-white shadow"
                  : "rounded-lg px-2.5 py-1 text-zinc-700 hover:text-violet-700"
              }
            >
              EL
            </Link>
            <Link
              href={englishHref}
              className={
                lang === "en"
                  ? "rounded-lg bg-violet-600 px-2.5 py-1 text-white shadow"
                  : "rounded-lg px-2.5 py-1 text-zinc-700 hover:text-violet-700"
              }
            >
              EN
            </Link>
          </div>
        </div>
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

      <DashboardBookingsView
        bookings={dashboardRows}
        view={view}
        lang={lang}
        salonTimezone={salon.timezone}
        filterDate={dateStr}
        tableLabels={{
          date: t.date,
          time: t.time,
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

type DashboardStaffOption = {
  id: string;
  name: string;
  calendarId: string | null;
};

type DashboardHrefParams = {
  lang: Locale;
  date: string;
  staffId: string;
  serviceId: string;
  status: string;
  phone: string;
  view: "list" | "grouped";
};

function dashboardHref({ lang, date, staffId, serviceId, status, phone, view }: DashboardHrefParams) {
  const query = new URLSearchParams();
  if (lang === "en") {
    query.set("lang", "en");
  }
  if (date) {
    query.set("date", date);
  }
  if (staffId) {
    query.set("staffId", staffId);
  }
  if (serviceId) {
    query.set("serviceId", serviceId);
  }
  if (status) {
    query.set("status", status);
  }
  if (phone) {
    query.set("phone", phone);
  }
  if (view === "list") {
    query.set("view", view);
  }

  const qs = query.toString();
  return `/dashboard${qs ? `?${qs}` : ""}`;
}

type CalendarRowParams = {
  staff: DashboardStaffOption[];
  start: Date;
  endExclusive: Date;
  selectedStaffId: string;
  selectedServiceId: string;
  selectedServiceName: string;
  statusFiltered: boolean;
  phoneQuery: string;
  persistedGoogleEventIds: Set<string>;
};

async function loadCalendarOnlyRows({
  staff,
  start,
  endExclusive,
  selectedStaffId,
  selectedServiceId,
  selectedServiceName,
  statusFiltered,
  phoneQuery,
  persistedGoogleEventIds,
}: CalendarRowParams): Promise<DashboardBookingRow[]> {
  if (statusFiltered) {
    return [];
  }

  const calendars = new Map<string, DashboardStaffOption>();
  for (const member of staff) {
    if (selectedStaffId && member.id !== selectedStaffId) {
      continue;
    }
    const calendarId = resolveGoogleCalendarId(member.calendarId);
    if (!calendarId || calendars.has(calendarId)) {
      continue;
    }
    calendars.set(calendarId, member);
  }

  const rows = await Promise.all(
    [...calendars.entries()].map(async ([calendarId, member]) => {
      const result = await listGoogleCalendarEvents({
        calendarId,
        timeMin: start,
        timeMax: endExclusive,
      });
      if (!result.ok) {
        return [];
      }

      return result.events
        .filter((event) => !persistedGoogleEventIds.has(event.id))
        .map((event): DashboardBookingRow | null => {
          const parsed = parseCalendarEvent(event.summary, event.description);
          if (selectedServiceId && !sameText(parsed.serviceName, selectedServiceName)) {
            return null;
          }
          if (phoneQuery && !parsed.phone.toLowerCase().includes(phoneQuery.toLowerCase())) {
            return null;
          }

          return {
            kind: "calendar",
            id: `calendar:${event.calendarId}:${event.id}`,
            calendarId: event.calendarId,
            googleEventId: event.id,
            startsAt: event.start,
            endsAt: event.end,
            status: "CALENDAR",
            staffId: member.id,
            customer: {
              name: parsed.customerName,
              phoneE164: parsed.phone || "—",
            },
            service: { name: parsed.serviceName },
            staff: { name: member.name },
          };
        })
        .filter((row): row is DashboardBookingRow => row !== null);
    }),
  );

  return rows.flat();
}

function parseCalendarEvent(summary: string, description: string | null) {
  const separator = summary.indexOf(" - ");
  const serviceName = separator > 0 ? summary.slice(0, separator).trim() : summary.trim();
  const customerName =
    separator > 0 ? summary.slice(separator + 3).trim() || "Google Calendar" : "Google Calendar";
  const phoneMatch = description?.match(/Phone:\s*([^\s<]+)/i);

  return {
    serviceName: serviceName || "Google Calendar",
    customerName,
    phone: phoneMatch?.[1] ?? "",
  };
}

function sameText(a: string, b: string) {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}
