import Link from "next/link";
import { ensureSalonSeed } from "@/lib/bootstrap";
import { isDashboardLinkAuthAvailable } from "@/lib/dashboard-auth";
import { parseLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { DashboardClosuresPanel } from "@/app/dashboard/dashboard-closures-panel";

export default async function DashboardClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);
  const t =
    lang === "el"
      ? {
          title: "Κλειστές ημέρες / αργίες",
          subtitle: "Ορίστε ημέρες ή περιόδους όπου το salon δεν δέχεται νέες κρατήσεις.",
          back: "← Dashboard",
          noSalon: "Δεν υπάρχει salon.",
          mutationsOff:
            "Οι αλλαγές είναι απενεργοποιημένες μέχρι να οριστεί DASHBOARD_LINK_SECRET.",
          panel: {
            title: "Διαχείριση κλειστών περιόδων",
            subtitle:
              "Οι ημερομηνίες είναι στη ζώνη ώρας του salon και το τέλος συμπεριλαμβάνεται.",
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
          title: "Closed days / holidays",
          subtitle: "Set dates or ranges when the salon should not accept new bookings.",
          back: "← Dashboard",
          noSalon: "No salon configured.",
          mutationsOff: "Changes are disabled until DASHBOARD_LINK_SECRET is set.",
          panel: {
            title: "Manage closure periods",
            subtitle: "Dates use the salon timezone and the end date is inclusive.",
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
        <p className="text-sm text-red-600">{t.noSalon}</p>
      </div>
    );
  }

  const closures = await prisma.salonClosure.findMany({
    where: { salonId: salon.id },
    orderBy: { startDate: "asc" },
    select: { id: true, startDate: true, endDate: true, label: true },
  });
  const mutationsAllowed = isDashboardLinkAuthAvailable();
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

      <DashboardClosuresPanel
        lang={lang}
        closures={closures}
        mutationsAllowed={mutationsAllowed}
        labels={t.panel}
      />
    </div>
  );
}
