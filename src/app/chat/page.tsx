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
          flowLabel: "Ροή κράτησης",
          stepService: "Υπηρεσία",
          stepStaff: "Staff",
          stepDate: "Ημ/νία",
          stepTime: "Ώρα",
          stepDetails: "Στοιχεία",
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
          flowLabel: "Booking flow",
          stepService: "Service",
          stepStaff: "Staff",
          stepDate: "Date",
          stepTime: "Time",
          stepDetails: "Details",
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
  const [resultTone, setResultTone] = useState<"success" | "error" | "neutral">(
    "neutral",
  );
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
      setResultTone("error");
      return;
    }

    setBusy(true);
    setResult("");
    setResultTone("neutral");
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
      setResultTone("error");
      setBusy(false);
      return;
    }

    setResult(`${t.success} ${data.manageUrl}`);
    setResultTone("success");
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-zinc-500">{t.langLabel}:</span>
        <button
          type="button"
          onClick={() => setLocale("el")}
          className={`rounded-md px-2 py-1 transition ${
            locale === "el"
              ? "border border-violet-200 bg-[var(--primary-soft)] font-medium text-violet-700"
              : "border border-zinc-300 text-zinc-700 hover:border-violet-300 hover:text-violet-700"
          }`}
        >
          {t.greek}
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`rounded-md px-2 py-1 transition ${
            locale === "en"
              ? "border border-violet-200 bg-[var(--primary-soft)] font-medium text-violet-700"
              : "border border-zinc-300 text-zinc-700 hover:border-violet-300 hover:text-violet-700"
          }`}
        >
          {t.english}
        </button>
      </div>
      <h1 className="mb-1 text-2xl font-semibold">{t.title}</h1>
      <p className="mb-6 text-sm text-zinc-600">{t.subtitle}</p>
      <BookingProgress
        t={t}
        serviceSelected={Boolean(serviceId)}
        staffSelected={Boolean(staffId)}
        dateSelected={Boolean(date)}
        slotSelected={Boolean(slot)}
        detailsReady={Boolean(name && phone)}
      />

      <div className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-white/95 p-4 shadow-lg shadow-violet-100/30">
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
          className="w-fit rounded-xl border border-zinc-300 px-3 py-2 text-sm transition focus:border-violet-300"
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
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition focus:border-violet-300"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t.phonePh}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm transition focus:border-violet-300"
          />
        </div>

        <div className="rounded-xl border border-violet-100 bg-[var(--primary-soft)] p-3 text-sm text-zinc-800">
          <p className="font-semibold text-violet-800">{t.bookingSummary}</p>
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
          className="w-fit rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-300/70 transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t.booking : t.bookNow}
        </button>

        {result && (
          <p
            className={`rounded-xl border px-3 py-2 text-sm ${
              resultTone === "error"
                ? "border-red-200 bg-[var(--error-soft)] text-[var(--error-text)]"
                : "border-emerald-200 bg-[var(--success-soft)] text-[var(--success-text)]"
            }`}
          >
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
          ? "border border-zinc-200 bg-zinc-100 text-zinc-800"
          : "ml-auto bg-[var(--primary)] text-white"
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
      ? "border-violet-300 bg-[var(--primary-soft)] text-violet-900 ring-2 ring-violet-200"
      : "border-zinc-300 bg-white hover:border-violet-300 hover:bg-violet-50/40"
  }`;
}

function BookingProgress({
  t,
  serviceSelected,
  staffSelected,
  dateSelected,
  slotSelected,
  detailsReady,
}: {
  t: {
    flowLabel: string;
    stepService: string;
    stepStaff: string;
    stepDate: string;
    stepTime: string;
    stepDetails: string;
  };
  serviceSelected: boolean;
  staffSelected: boolean;
  dateSelected: boolean;
  slotSelected: boolean;
  detailsReady: boolean;
}) {
  const steps = [
    { label: t.stepService, done: serviceSelected },
    { label: t.stepStaff, done: staffSelected },
    { label: t.stepDate, done: dateSelected },
    { label: t.stepTime, done: slotSelected },
    { label: t.stepDetails, done: detailsReady },
  ];

  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t.flowLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <span
            key={step.label}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              step.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-white text-zinc-500"
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
