import Link from "next/link";
import { parseLocale } from "@/lib/locale";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = parseLocale(params.lang);
  const t =
    lang === "el"
      ? {
          title: "Κρατήσεις Glow Beauty Salon",
          subtitle:
            "Mobile-first assistant για επιλογή υπηρεσίας, staff και ώρας με επιβεβαίωση SMS.",
          startChat: "Έναρξη Κράτησης",
          openDashboard: "Άνοιγμα Dashboard",
          quickView: "Γρήγορη Εικόνα Manager (επόμενο βήμα)",
          q1: "- Σημερινά ραντεβού ανά staff",
          q2: "- Ενέργειες αλλαγής/ακύρωσης",
          q3: "- Αναζήτηση με τηλέφωνο πελάτη",
          q4: "- Φίλτρα ανά υπηρεσία και status",
          langLabel: "Γλώσσα",
          greek: "Ελληνικά",
          english: "English",
        }
      : {
          title: "Glow Beauty Salon Booking",
          subtitle:
            "Mobile-first booking assistant for service, staff, and time selection with SMS confirmations.",
          startChat: "Start Booking Chat",
          openDashboard: "Open Dashboard",
          quickView: "Manager Quick View (next step)",
          q1: "- Today bookings by staff",
          q2: "- Reschedule and cancel actions",
          q3: "- Search by customer phone",
          q4: "- Filter by service and status",
          langLabel: "Language",
          greek: "Greek",
          english: "English",
        };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <main className="grid w-full gap-4 rounded-3xl border border-zinc-200/80 bg-white/90 p-8 shadow-lg shadow-violet-100/40 backdrop-blur-sm md:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span className="text-zinc-500">{t.langLabel}:</span>
            <Link
              href="/?lang=el"
              className={`rounded-md px-2 py-1 transition ${lang === "el" ? "border border-violet-200 bg-[var(--primary-soft)] font-medium text-violet-700" : "border border-zinc-300 text-zinc-700 hover:border-violet-300 hover:text-violet-700"}`}
            >
              {t.greek}
            </Link>
            <Link
              href="/?lang=en"
              className={`rounded-md px-2 py-1 transition ${lang === "en" ? "border border-violet-200 bg-[var(--primary-soft)] font-medium text-violet-700" : "border border-zinc-300 text-zinc-700 hover:border-violet-300 hover:text-violet-700"}`}
            >
              {t.english}
            </Link>
          </div>
          <p className="mb-2 inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-violet-700">
            QR -&gt; Chat -&gt; Book -&gt; SMS
          </p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mb-6 max-w-md text-sm leading-6 text-zinc-700">{t.subtitle}</p>
          <Link
            href={`/chat?lang=${lang}`}
            className="inline-block rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-300/70 transition hover:bg-[var(--primary-hover)]"
          >
            {t.startChat}
          </Link>
          <Link
            prefetch={false}
            href={`/dashboard?lang=${lang}`}
            className="ml-2 inline-block rounded-xl border border-violet-200 bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:text-violet-800"
          >
            {t.openDashboard}
          </Link>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-[var(--primary-soft)] p-4 text-sm text-zinc-700">
          <p className="mb-2 font-semibold text-violet-800">{t.quickView}</p>
          <ul className="space-y-1">
            <li>{t.q1}</li>
            <li>{t.q2}</li>
            <li>{t.q3}</li>
            <li>{t.q4}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
