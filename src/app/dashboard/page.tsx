import { format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);
  const t =
    lang === "el"
      ? {
          title: "Dashboard Διαχείρισης",
          subtitle: "Απλή προβολή όλων των ραντεβού για όλα τα μέλη staff.",
          dt: "Ημερομηνία & Ώρα",
          customer: "Πελάτης",
          phone: "Τηλέφωνο",
          service: "Υπηρεσία",
          staff: "Staff",
          status: "Κατάσταση",
          empty: "Δεν υπάρχουν ραντεβού ακόμα.",
        }
      : {
          title: "Manager Dashboard",
          subtitle: "Simple all-bookings view across all staff members.",
          dt: "Date & Time",
          customer: "Customer",
          phone: "Phone",
          service: "Service",
          staff: "Staff",
          status: "Status",
          empty: "No bookings yet.",
        };
  const dateFnsLocale = lang === "el" ? el : enGB;

  await ensureSalonSeed();

  const bookings = await prisma.booking.findMany({
    orderBy: { startsAt: "asc" },
    include: { customer: true, service: true, staff: true },
    take: 100,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-sm text-zinc-600">{t.subtitle}</p>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white/95 shadow-lg shadow-violet-100/30">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--primary-soft)] text-violet-900">
            <tr>
              <th className="px-3 py-2">{t.dt}</th>
              <th className="px-3 py-2">{t.customer}</th>
              <th className="px-3 py-2">{t.phone}</th>
              <th className="px-3 py-2">{t.service}</th>
              <th className="px-3 py-2">{t.staff}</th>
              <th className="px-3 py-2">{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={6}>
                  {t.empty}
                </td>
              </tr>
            )}
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className="border-t border-zinc-100 transition-colors hover:bg-violet-50/40"
              >
                <td className="px-3 py-2">
                  {format(booking.startsAt, "PPP p", { locale: dateFnsLocale })}
                </td>
                <td className="px-3 py-2">{booking.customer.name}</td>
                <td className="px-3 py-2">{booking.customer.phoneE164}</td>
                <td className="px-3 py-2">{booking.service.name}</td>
                <td className="px-3 py-2">{booking.staff.name}</td>
                <td className="px-3 py-2">
                  <span className={statusClass(booking.status)}>{booking.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "CONFIRMED") {
    return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }

  if (status === "CANCELLED") {
    return "inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700";
  }

  return "inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700";
}
