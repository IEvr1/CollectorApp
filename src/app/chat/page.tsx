"use client";

import { useEffect, useMemo, useState } from "react";
import { parseLocale, type Locale } from "@/lib/locale";

type Service = { id: string; name: string; durationMin: number };
type Staff = { id: string; name: string };

const todayStr = new Date().toISOString().slice(0, 10);

export default function ChatPage() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return "el";
    }
    const params = new URLSearchParams(window.location.search);
    return parseLocale(params.get("lang"));
  });
  const t =
    locale === "el"
      ? {
          title: "Βοηθός Κρατήσεων Glow Beauty Salon",
          subtitle: "Ροή κράτησης για υπηρεσία, staff και ώρα.",
          welcome: "Καλώς ήρθατε! Ποια υπηρεσία θέλετε;",
          pickStaff: "Επιλέξτε το staff που προτιμάτε.",
          pickDate: "Διαλέξτε ημερομηνία.",
          slots: "Διαθέσιμες ώρες:",
          noSlots: "Δεν υπάρχουν διαθέσιμες ώρες για αυτή την επιλογή.",
          details: "Τέλεια. Επιβεβαιώστε τα στοιχεία σας.",
          namePh: "Ονοματεπώνυμο",
          phonePh: "Κυπριακό κινητό (+3579XXXXXXX)",
          bookingSummary: "Σύνοψη κράτησης",
          service: "Υπηρεσία",
          time: "Ώρα",
          booking: "Καταχώρηση...",
          bookNow: "Κράτηση Ραντεβού",
          missing: "Συμπληρώστε όλα τα πεδία πριν την κράτηση.",
          failed: "Η κράτηση απέτυχε.",
          success: "Η κράτηση ολοκληρώθηκε! Link διαχείρισης:",
          langLabel: "Γλώσσα",
          greek: "Ελληνικά",
          english: "English",
        }
      : {
          title: "Glow Beauty Salon Assistant",
          subtitle: "Chat-style booking flow with quick service, staff, and time selection.",
          welcome: "Welcome! Which service would you like?",
          pickStaff: "Pick your preferred staff member.",
          pickDate: "Choose your date.",
          slots: "Available time slots:",
          noSlots: "No slots currently available for this selection.",
          details: "Great. Please confirm your details.",
          namePh: "Full name",
          phonePh: "Cyprus mobile (+3579XXXXXXX)",
          bookingSummary: "Booking summary",
          service: "Service",
          time: "Time",
          booking: "Booking...",
          bookNow: "Book Appointment",
          missing: "Please complete all fields before booking.",
          failed: "Booking failed.",
          success: "Booked! Manage link:",
          langLabel: "Language",
          greek: "Greek",
          english: "English",
        };
  const intlLocale = locale === "el" ? "el-CY" : "en-GB";

  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayStr);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return new URLSearchParams(window.location.search).get("phone") ?? "";
  });
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", locale);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [locale]);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, staffId, date, lang: locale }),
      });
      const data = await response.json();
      setServices(data.services ?? []);
      setStaff(data.staff ?? []);
      setSlots(data.slots ?? []);
      if (!staffId && data.staff?.[0]) {
        setStaffId(data.staff[0].id);
      }
    }

    void load();
  }, [serviceId, staffId, date, locale]);

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId),
    [services, serviceId],
  );

  async function bookNow() {
    if (!serviceId || !staffId || !slot || !name || !phone) {
      setResult(t.missing);
      return;
    }

    setBusy(true);
    setResult("");
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        staffId,
        startsAt: slot,
        name,
        phone,
        lang: locale,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setResult(data.error ?? t.failed);
      setBusy(false);
      return;
    }

    setResult(`${t.success} ${data.manageUrl}`);
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-zinc-500">{t.langLabel}:</span>
        <button
          type="button"
          onClick={() => setLocale("el")}
          className={`rounded-md px-2 py-1 ${locale === "el" ? "bg-black text-white" : "border border-zinc-300"}`}
        >
          {t.greek}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-md px-2 py-1 ${locale === "en" ? "bg-black text-white" : "border border-zinc-300"}`}
        >
          {t.english}
        </button>
      </div>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-sm text-zinc-600">{t.subtitle}</p>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <Bubble role="assistant" text={t.welcome} />
        <CardGrid>
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setServiceId(item.id)}
              className={choiceClass(serviceId === item.id)}
            >
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-zinc-500">{item.durationMin} min</p>
            </button>
          ))}
        </CardGrid>

        <Bubble role="assistant" text={t.pickStaff} />
        <CardGrid>
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setStaffId(member.id)}
              className={choiceClass(staffId === member.id)}
            >
              {member.name}
            </button>
          ))}
        </CardGrid>

        <Bubble role="assistant" text={t.pickDate} />
        <input
          value={date}
          onChange={(event) => setDate(event.target.value)}
          type="date"
          className="w-fit rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        />

        <Bubble role="assistant" text={t.slots} />
        <CardGrid>
          {slots.length === 0 && (
            <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
              {t.noSlots}
            </p>
          )}
          {slots.map((slotIso) => (
            <button
              key={slotIso}
              type="button"
              onClick={() => setSlot(slotIso)}
              className={choiceClass(slot === slotIso)}
            >
              {new Date(slotIso).toLocaleTimeString(intlLocale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </button>
          ))}
        </CardGrid>

        <Bubble role="assistant" text={t.details} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.namePh}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t.phonePh}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl bg-zinc-100 p-3 text-sm">
          <p className="font-medium">{t.bookingSummary}</p>
          <p>
            {t.service}: {selectedService?.name ?? "-"}
          </p>
          <p>
            {t.time}: {slot ? new Date(slot).toLocaleString(intlLocale) : "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void bookNow()}
          disabled={busy}
          className="w-fit rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? t.booking : t.bookNow}
        </button>

        {result && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {result}
          </p>
        )}
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: "assistant" | "user"; text: string }) {
  return (
    <div
      className={`w-fit max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
        role === "assistant"
          ? "bg-zinc-100 text-zinc-800"
          : "ml-auto bg-black text-white"
      }`}
    >
      {text}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}

function choiceClass(selected: boolean) {
  return `rounded-xl border px-3 py-2 text-left text-sm transition ${
    selected
      ? "border-black bg-black text-white"
      : "border-zinc-300 bg-white hover:border-zinc-500"
  }`;
}
