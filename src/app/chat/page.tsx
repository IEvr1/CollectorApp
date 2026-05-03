"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizePhone } from "@/lib/phone";
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
          phoneRetry:
            "Ο αριθμός δεν είναι έγκυρο κυπριακό κινητό. Παρακαλώ πληκτρολογήστε ξανά το κινητό σας (π.χ. +3579XXXXXXX ή 9XXXXXXX).",
          failed: "Η κράτηση απέτυχε.",
          success: "Η κράτηση ολοκληρώθηκε! Link διαχείρισης:",
          langLabel: "Γλώσσα",
          greek: "Ελληνικά",
          english: "English",
        }
      : {
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
          phoneRetry:
            "That is not a valid Cyprus mobile number. Please type your mobile again (e.g. +3579XXXXXXX or 9XXXXXXX).",
          failed: "Booking failed.",
          success: "Booked! Manage link:",
          langLabel: "Language",
          greek: "Greek",
          english: "English",
        };
  const intlLocale = locale === "el" ? "el-CY" : "en-GB";

  const [salonName, setSalonName] = useState("");
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
  const [phoneRetryMessage, setPhoneRetryMessage] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) {
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [
    serviceId,
    staffId,
    date,
    slot,
    result,
    slots,
    services.length,
    locale,
    busy,
    phoneRetryMessage,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", locale);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
    setPhoneRetryMessage(null);
  }, [locale]);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, staffId, date, lang: locale }),
      });
      const data = await response.json();
      if (data.salon?.name) {
        setSalonName(data.salon.name);
      }
      setServices(data.services ?? []);
      setStaff(data.staff ?? []);
      setSlots(data.slots ?? []);
    }

    void load();
  }, [serviceId, staffId, date, locale]);

  function selectService(id: string) {
    setServiceId(id);
    setStaffId("");
    setSlot("");
  }

  function selectStaff(id: string) {
    setStaffId(id);
    setSlot("");
  }

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId),
    [services, serviceId],
  );
  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === staffId),
    [staff, staffId],
  );

  const hasService = Boolean(serviceId);
  const hasStaff = Boolean(staffId);
  const hasSlot = Boolean(slot);

  async function bookNow() {
    if (!serviceId || !staffId || !slot || !name || !phone) {
      setPhoneRetryMessage(null);
      setResult(t.missing);
      setResultTone("error");
      return;
    }

    try {
      normalizePhone(phone);
    } catch {
      setResult("");
      setResultTone("neutral");
      setPhoneRetryMessage(t.phoneRetry);
      return;
    }

    setBusy(true);
    setResult("");
    setResultTone("neutral");
    setPhoneRetryMessage(null);
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
      if (response.status === 400 && data.code === "INVALID_PHONE") {
        setResult("");
        setResultTone("neutral");
        setPhoneRetryMessage(t.phoneRetry);
      } else {
        setPhoneRetryMessage(null);
        setResult(data.error ?? t.failed);
        setResultTone("error");
      }
      setBusy(false);
      return;
    }

    setPhoneRetryMessage(null);
    setResult(`${t.success} ${data.manageUrl}`);
    setResultTone("success");
    setBusy(false);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col px-4 py-6">
      <header className="mb-4 shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">
          {salonName || "\u00a0"}
        </h1>
      </header>

      <div
        ref={chatScrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 shadow-inner"
      >
        <Bubble role="assistant" text={t.welcome} />
        {!hasService && (
          <CardGrid>
            {services.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectService(item.id)}
                className={choiceClass(false)}
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-zinc-500">{item.durationMin} min</p>
              </button>
            ))}
          </CardGrid>
        )}

        {hasService && selectedService && (
          <>
            <Bubble role="user" text={selectedService.name} />
            <Bubble role="assistant" text={t.pickStaff} />
            {!hasStaff && (
              <CardGrid>
                {staff.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => selectStaff(member.id)}
                    className={choiceClass(false)}
                  >
                    {member.name}
                  </button>
                ))}
              </CardGrid>
            )}
          </>
        )}

        {hasStaff && selectedStaff && (
          <>
            <Bubble role="user" text={selectedStaff.name} />
            <Bubble role="assistant" text={t.pickDate} />
            <div className="max-w-[85%]">
              <input
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSlot("");
                }}
                type="date"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-violet-300"
              />
            </div>
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
          </>
        )}

        {hasSlot && (
          <>
            <Bubble
              role="user"
              text={new Date(slot).toLocaleString(intlLocale, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            />
            <Bubble role="assistant" text={t.details} />
            <div className="grid max-w-[85%] gap-2 sm:max-w-full sm:grid-cols-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.namePh}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-violet-300"
              />
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setPhoneRetryMessage(null);
                }}
                placeholder={t.phonePh}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-violet-300"
              />
            </div>

            {phoneRetryMessage && (
              <Bubble
                role="assistant"
                text={phoneRetryMessage}
                tone="error"
              />
            )}

            <div className="max-w-[85%] rounded-xl border border-violet-100 bg-[var(--primary-soft)] p-3 text-sm text-zinc-800 sm:max-w-full">
              <p className="font-semibold text-violet-800">{t.bookingSummary}</p>
              <p>
                {t.service}: {selectedService?.name ?? "-"}
              </p>
              <p>
                {t.time}:{" "}
                {slot ? new Date(slot).toLocaleString(intlLocale) : "-"}
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
          </>
        )}

        {result && (
          <Bubble
            role="assistant"
            text={result}
            tone={resultTone === "error" ? "error" : resultTone === "success" ? "success" : "neutral"}
          />
        )}
      </div>
    </div>
  );
}

function Bubble({
  role,
  text,
  tone = "neutral",
}: {
  role: "assistant" | "user";
  text: string;
  tone?: "neutral" | "success" | "error";
}) {
  const assistantTone =
    tone === "error"
      ? "border border-red-200 bg-[var(--error-soft)] text-[var(--error-text)]"
      : tone === "success"
        ? "border border-emerald-200 bg-[var(--success-soft)] text-[var(--success-text)]"
        : "border border-zinc-200 bg-white text-zinc-800 shadow-sm";

  return (
    <div
      className={`w-fit max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
        role === "assistant"
          ? assistantTone
          : "ml-auto self-end bg-[var(--primary)] text-white shadow-sm"
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
