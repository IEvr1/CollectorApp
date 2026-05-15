import type { Prisma } from "@prisma/client";
import type { Locale } from "@/lib/locale";
import { formatSalonDate, formatSalonTime, localeTagForLang } from "@/lib/timezone";
import {
  DashboardBookingActions,
  DashboardCalendarOnlyActions,
} from "@/app/dashboard/dashboard-booking-actions";

export type DashboardBookingRow = Prisma.BookingGetPayload<{
  include: { customer: true; service: true; staff: true };
}> | {
  kind: "calendar";
  id: string;
  calendarId: string;
  googleEventId: string;
  startsAt: Date;
  endsAt: Date;
  status: "CALENDAR";
  staffId: string;
  customer: { name: string; phoneE164: string };
  service: { name: string };
  staff: { name: string };
};

type TableLabels = {
  date: string;
  time: string;
  customer: string;
  phone: string;
  service: string;
  staff: string;
  status: string;
  actions: string;
  empty: string;
};

type ActionLabels = {
  cancel: string;
  reschedule: string;
  confirmCancel: string;
  loadSlots: string;
  pickSlot: string;
  close: string;
  working: string;
  errorPrefix: string;
  requestSent: string;
  calendarOnlyMissingPhone: string;
};

type Props = {
  bookings: DashboardBookingRow[];
  view: "list" | "grouped";
  lang: Locale;
  salonTimezone: string;
  filterDate: string;
  tableLabels: TableLabels;
  actionLabels: ActionLabels;
};

function statusClass(status: string) {
  if (status === "CONFIRMED" || status === "CALENDAR") {
    return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }
  if (status === "CANCELLED") {
    return "inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700";
  }
  return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700";
}

function statusLabel(status: string, lang: Locale) {
  if (status === "CANCELLED") {
    return lang === "el" ? "Ακυρωμένο" : "Cancelled";
  }
  return lang === "el" ? "Επιβεβαιωμένο" : "Confirmed";
}

function isCalendarOnlyRow(booking: DashboardBookingRow): booking is Extract<DashboardBookingRow, { kind: "calendar" }> {
  return "kind" in booking && booking.kind === "calendar";
}

function BookingActionsCell({
  booking,
  filterDate,
  lang,
  actionLabels,
}: {
  booking: DashboardBookingRow;
  filterDate: string;
  lang: Locale;
  actionLabels: ActionLabels;
}) {
  if (isCalendarOnlyRow(booking)) {
    return (
      <DashboardCalendarOnlyActions
        lang={lang}
        details={{
          calendarId: booking.calendarId,
          googleEventId: booking.googleEventId,
          staffId: booking.staffId,
          serviceName: booking.service.name,
          customerName: booking.customer.name,
          phoneE164: booking.customer.phoneE164,
          startsAtIso: booking.startsAt.toISOString(),
          endsAtIso: booking.endsAt.toISOString(),
        }}
        labels={actionLabels}
      />
    );
  }

  const now = new Date();
  const canReschedule = booking.status === "CONFIRMED" && booking.endsAt > now;

  return (
    <DashboardBookingActions
      bookingId={booking.id}
      lang={lang}
      canCancel={false}
      canReschedule={canReschedule}
      defaultDate={filterDate}
      labels={actionLabels}
    />
  );
}

function RowCells({
  booking,
  intlLocale,
  salonTimezone,
  filterDate,
  lang,
  actionLabels,
}: {
  booking: DashboardBookingRow;
  intlLocale: string;
  salonTimezone: string;
  filterDate: string;
  lang: Locale;
  actionLabels: ActionLabels;
}) {
  return (
    <>
      <td className="px-3 py-2 whitespace-nowrap">
        {formatSalonDate(booking.startsAt, salonTimezone, intlLocale)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {formatSalonTime(booking.startsAt, salonTimezone, intlLocale)}
      </td>
      <td className="px-3 py-2">{booking.customer.name}</td>
      <td className="px-3 py-2">{booking.customer.phoneE164}</td>
      <td className="px-3 py-2">{booking.service.name}</td>
      <td className="px-3 py-2">{booking.staff.name}</td>
      <td className="px-3 py-2">
        <span className={statusClass(booking.status)}>{statusLabel(booking.status, lang)}</span>
      </td>
      <td className="px-3 py-2 align-top">
        <BookingActionsCell
          booking={booking}
          filterDate={filterDate}
          lang={lang}
          actionLabels={actionLabels}
        />
      </td>
    </>
  );
}

export function DashboardBookingsView({
  bookings,
  view,
  lang,
  salonTimezone,
  filterDate,
  tableLabels,
  actionLabels,
}: Props) {
  const intlLocale = localeTagForLang(lang);

  if (bookings.length === 0) {
    return (
      <p className="rounded-2xl border border-zinc-200/80 bg-white/95 px-4 py-8 text-center text-sm text-zinc-500">
        {tableLabels.empty}
      </p>
    );
  }

  if (view === "list") {
    return (
      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white/95 shadow-lg shadow-violet-100/30">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--primary-soft)] text-violet-900">
            <tr>
              <th className="px-3 py-2">{tableLabels.date}</th>
              <th className="px-3 py-2">{tableLabels.time}</th>
              <th className="px-3 py-2">{tableLabels.customer}</th>
              <th className="px-3 py-2">{tableLabels.phone}</th>
              <th className="px-3 py-2">{tableLabels.service}</th>
              <th className="px-3 py-2">{tableLabels.staff}</th>
              <th className="px-3 py-2">{tableLabels.status}</th>
              <th className="px-3 py-2">{tableLabels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className="border-t border-zinc-100 transition-colors hover:bg-violet-50/40"
              >
                <RowCells
                  booking={booking}
                  intlLocale={intlLocale}
                  salonTimezone={salonTimezone}
                  filterDate={filterDate}
                  lang={lang}
                  actionLabels={actionLabels}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const byStaff = new Map<string, { name: string; rows: DashboardBookingRow[] }>();
  for (const b of bookings) {
    const cur = byStaff.get(b.staffId);
    if (cur) {
      cur.rows.push(b);
    } else {
      byStaff.set(b.staffId, { name: b.staff.name, rows: [b] });
    }
  }
  for (const g of byStaff.values()) {
    g.rows.sort((a, c) => a.startsAt.getTime() - c.startsAt.getTime());
  }

  const staffSections = [...byStaff.entries()].sort((a, b) => {
    const firstA = a[1].rows[0]?.startsAt.getTime() ?? Number.POSITIVE_INFINITY;
    const firstB = b[1].rows[0]?.startsAt.getTime() ?? Number.POSITIVE_INFINITY;
    return firstA - firstB || a[1].name.localeCompare(b[1].name);
  });

  return (
    <div className="flex flex-col gap-6">
      {staffSections.map(([staffId, group]) => (
        <section key={staffId} className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-md">
          <h2 className="border-b border-zinc-100 bg-[var(--primary-soft)] px-4 py-2 text-sm font-semibold text-violet-900">
            {group.name}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-3 py-2">{tableLabels.date}</th>
                  <th className="px-3 py-2">{tableLabels.time}</th>
                  <th className="px-3 py-2">{tableLabels.customer}</th>
                  <th className="px-3 py-2">{tableLabels.phone}</th>
                  <th className="px-3 py-2">{tableLabels.service}</th>
                  <th className="px-3 py-2">{tableLabels.status}</th>
                  <th className="px-3 py-2">{tableLabels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((booking) => (
                  <tr key={booking.id} className="border-t border-zinc-100 hover:bg-violet-50/30">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatSalonDate(booking.startsAt, salonTimezone, intlLocale)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatSalonTime(booking.startsAt, salonTimezone, intlLocale)}
                    </td>
                    <td className="px-3 py-2">{booking.customer.name}</td>
                    <td className="px-3 py-2">{booking.customer.phoneE164}</td>
                    <td className="px-3 py-2">{booking.service.name}</td>
                    <td className="px-3 py-2">
                      <span className={statusClass(booking.status)}>{statusLabel(booking.status, lang)}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <BookingActionsCell
                        booking={booking}
                        filterDate={filterDate}
                        lang={lang}
                        actionLabels={actionLabels}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
