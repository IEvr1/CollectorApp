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
      <main className="grid w-full gap-4 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm md:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span className="text-zinc-500">{t.langLabel}:</span>
            <Link
              href="/?lang=el"
              className={`rounded-md px-2 py-1 ${lang === "el" ? "bg-black text-white" : "border border-zinc-300"}`}
            >
              {t.greek}
            </Link>
            <Link
              href="/?lang=en"
              className={`rounded-md px-2 py-1 ${lang === "en" ? "bg-black text-white" : "border border-zinc-300"}`}
            >
              {t.english}
            </Link>
          </div>
          <p className="mb-2 text-sm text-zinc-500">
            QR -&gt; Chat -&gt; Book -&gt; SMS
          </p>
          <h1 className="mb-3 text-3xl font-semibold">{t.title}</h1>
          <p className="mb-6 text-sm text-zinc-700">{t.subtitle}</p>
          <Link
            href={`/chat?lang=${lang}`}
            className="inline-block rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            {t.startChat}
          </Link>
          <Link
            href={`/dashboard?lang=${lang}`}
            className="ml-2 inline-block rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium"
          >
            {t.openDashboard}
          </Link>
        </div>
        <div className="rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700">
          <p className="mb-2 font-medium">{t.quickView}</p>
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
