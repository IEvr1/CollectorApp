"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizePhone } from "@/lib/phone";
import { parseLocale, type Locale } from "@/lib/locale";

type Service = { id: string; name: string; durationMin: number };
type Staff = { id: string; name: string };

type ManageBooking = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  service: { id: string; name: string; durationMin: number };
  staff: { id: string; name: string };
};

type ManageSummary = {
  salonName: string;
  salonTimezone: string;
  customerName: string | null;
  customerPhone: string;
  booking: ManageBooking | null;
  uiPhase: "manageable" | "past" | "cancelled" | "completed" | "no_booking";
  canManage: boolean;
};

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
          morning: "Πρωί",
          afternoon: "Απόγευμα",
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
          linkExpired: "Το link έληξε ή δεν είναι έγκυρο. Συνεχίστε κανονικά την κράτηση.",
          identityAsk: (name: string) => `Είστε ο/η ${name};`,
          newCustomer: "Νέος πελάτης",
          imCustomer: "Ναι, είμαι εγώ",
          welcomeBack: (name: string) => `Καλώς ήρθατε, ${name}!`,
          manageHeading: "Το ραντεβού σας",
          cancelBooking: "Ακύρωση ραντεβού",
          rescheduleBooking: "Αλλαγή ώρας",
          confirmCancel: "Είστε σίγουροι; Η ακύρωση είναι οριστική.",
          cancelling: "Ακύρωση...",
          cancelledOk: "Το ραντεβού ακυρώθηκε.",
          cancelFailed: "Η ακύρωση απέτυχε.",
          rescheduleTitle: "Επιλέξτε νέα ημερομηνία και ώρα",
          confirmReschedule: "Επιβεβαίωση νέας ώρας",
          rescheduling: "Ενημέρωση...",
          rescheduleOk: "Η ώρα ενημερώθηκε.",
          rescheduleFailed: "Η αλλαγή ώρας απέτυχε.",
          pastBooking: "Αυτό το ραντεβού έχει ήδη πραγματοποιηθεί ή έχει περάσει.",
          cancelledBooking: "Αυτό το ραντεβού είχε ακυρωθεί.",
          completedBooking: "Αυτό το ραντεβού έχει ολοκληρωθεί.",
          bookAgain: "Κλείστε νέο ραντεβού",
          manageDisclaimer:
            "Προσωπικό link — μην το προωθείτε. Όποιος το ανοίγει μπορεί να διαχειριστεί το ραντεβού για τον αριθμό του SMS.",
          staffLabel: "Staff",
        }
      : {
          welcome: "Welcome! Which service would you like?",
          pickStaff: "Pick your preferred staff member.",
          pickDate: "Choose your date.",
          slots: "Available time slots:",
          morning: "Morning",
          afternoon: "Afternoon",
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
          linkExpired: "This link has expired or is invalid. Continue to book as usual.",
          identityAsk: (name: string) => `Are you ${name}?`,
          newCustomer: "New customer",
          imCustomer: "Yes, that's me",
          welcomeBack: (name: string) => `Welcome, ${name}!`,
          manageHeading: "Your appointment",
          cancelBooking: "Cancel appointment",
          rescheduleBooking: "Reschedule",
          confirmCancel: "Cancel this appointment? This cannot be undone.",
          cancelling: "Cancelling...",
          cancelledOk: "Your appointment has been cancelled.",
          cancelFailed: "Cancellation failed.",
          rescheduleTitle: "Pick a new date and time",
          confirmReschedule: "Confirm new time",
          rescheduling: "Updating...",
          rescheduleOk: "Your appointment time was updated.",
          rescheduleFailed: "Reschedule failed.",
          pastBooking: "This appointment has already taken place or is in the past.",
          cancelledBooking: "This appointment was cancelled.",
          completedBooking: "This appointment is completed.",
          bookAgain: "Book a new appointment",
          manageDisclaimer:
            "Personal link — do not forward. Anyone with this link can manage the appointment for the phone number that received the SMS.",
          staffLabel: "Staff",
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

  const [manage, setManage] = useState<ManageSummary | null | undefined>(undefined);
  const [identity, setIdentity] = useState<"pending" | "returning" | "new">("returning");
  const [manageView, setManageView] = useState<"home" | "reschedule">("home");
  const [rebookActive, setRebookActive] = useState(false);
  const [manageSlots, setManageSlots] = useState<string[]>([]);
  const [manageSlot, setManageSlot] = useState("");
  const [manageBusy, setManageBusy] = useState(false);

  const loadManageSummary = useCallback(async () => {
    const response = await fetch("/api/bookings/manage/summary", { credentials: "include" });
    if (response.status === 401) {
      setManage(null);
      return;
    }
    if (!response.ok) {
      setManage(null);
      return;
    }
    const data = (await response.json()) as ManageSummary;
    setManage(data);
    if (data.booking || data.customerName) {
      setIdentity("pending");
    } else {
      setIdentity("returning");
      if (data.customerPhone) {
        setPhone(data.customerPhone);
      }
    }
  }, []);

  useEffect(() => {
    void loadManageSummary();
  }, [loadManageSummary]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("link") === "expired") {
      setResult(t.linkExpired);
      setResultTone("error");
      params.delete("link");
      params.set("lang", locale);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [locale, t.linkExpired]);

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
    manage,
    identity,
    manageView,
    manageSlots,
    manageSlot,
    manageBusy,
    rebookActive,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("lang", locale);
    if (manage !== undefined) {
      params.delete("fromLink");
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
    setPhoneRetryMessage(null);
  }, [locale, manage]);

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

  useEffect(() => {
    if (manageView !== "reschedule" || !manage?.booking) {
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/bookings/manage/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date }),
      });
      const data = await response.json();
      if (!cancelled && response.ok) {
        setManageSlots(data.slots ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manageView, manage?.booking, date]);

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

  const { morningSlots, afternoonSlots } = useMemo(() => {
    const source = manageView === "reschedule" ? manageSlots : slots;
    const morning: string[] = [];
    const afternoon: string[] = [];
    for (const slotIso of source) {
      const hour = new Date(slotIso).getHours();
      if (hour < 12) {
        morning.push(slotIso);
      } else {
        afternoon.push(slotIso);
      }
    }
    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [slots, manageSlots, manageView]);

  const hasService = Boolean(serviceId);
  const hasStaff = Boolean(staffId);
  const hasSlot = Boolean(slot);

  async function clearManageSession() {
    await fetch("/api/bookings/manage/session", {
      method: "POST",
      credentials: "include",
    });
  }

  async function onNewCustomer() {
    await clearManageSession();
    setManage(null);
    setIdentity("returning");
    setRebookActive(false);
    setManageView("home");
    setServiceId("");
    setStaffId("");
    setSlot("");
    setName("");
    setPhone("");
    setManageSlots([]);
    setManageSlot("");
    setResult("");
    setResultTone("neutral");
    const params = new URLSearchParams();
    params.set("lang", locale);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  async function onReturningCustomer() {
    setIdentity("returning");
    if (manage?.customerName && !manage.booking) {
      setName(manage.customerName);
    }
    if (manage?.customerPhone) {
      setPhone(manage.customerPhone);
    }
    if (manage?.booking && manage.uiPhase === "manageable") {
      setSalonName(manage.salonName);
    }
    if (manage?.booking && manage.uiPhase === "manageable") {
      setManageView("home");
    }
    if (manage?.booking && ["past", "cancelled", "completed"].includes(manage.uiPhase)) {
      setRebookActive(false);
    }
  }

  async function onBookAgain() {
    if (!manage?.booking) {
      return;
    }
    const b = manage.booking;
    await clearManageSession();
    setServiceId(b.service.id);
    setStaffId(b.staff.id);
    setName(manage.customerName ?? "");
    setPhone(manage.customerPhone);
    setDate(todayStr);
    setSlot("");
    setSlots([]);
    setManage(null);
    setIdentity("returning");
    setRebookActive(true);
    setManageView("home");
    setResult("");
    setResultTone("neutral");
    const params = new URLSearchParams();
    params.set("lang", locale);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  async function onCancelBooking() {
    if (!window.confirm(t.confirmCancel)) {
      return;
    }
    setManageBusy(true);
    const response = await fetch("/api/bookings/manage/cancel", {
      method: "POST",
      credentials: "include",
    });
    setManageBusy(false);
    if (!response.ok) {
      setResult(t.cancelFailed);
      setResultTone("error");
      return;
    }
    setResult(t.cancelledOk);
    setResultTone("success");
    await loadManageSummary();
  }

  async function onConfirmReschedule() {
    if (!manageSlot) {
      return;
    }
    setManageBusy(true);
    const response = await fetch("/api/bookings/manage/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ startsAt: manageSlot }),
    });
    setManageBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setResult((data as { error?: string }).error ?? t.rescheduleFailed);
      setResultTone("error");
      return;
    }
    setResult(t.rescheduleOk);
    setResultTone("success");
    setManageView("home");
    setManageSlot("");
    await loadManageSummary();
  }

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
    setRebookActive(false);
  }

  const showNormalFlow =
    manage !== undefined &&
    (manage === null ||
      (identity === "returning" && (!manage.booking || rebookActive)));

  const showIdentityGate =
    manage &&
    identity === "pending" &&
    (Boolean(manage.booking) || Boolean(manage.customerName));

  const showManageHome =
    manage &&
    manage.booking &&
    identity === "returning" &&
    manage.uiPhase === "manageable" &&
    manageView === "home" &&
    !rebookActive;

  const showTerminalBooking =
    manage &&
    manage.booking &&
    identity === "returning" &&
    ["past", "cancelled", "completed"].includes(manage.uiPhase) &&
    !rebookActive;

  const showReschedule =
    manage?.booking &&
    identity === "returning" &&
    manage.uiPhase === "manageable" &&
    manageView === "reschedule";

  const gateName =
    manage?.customerName?.trim() ||
    (locale === "el" ? "ο πελάτης του κινητού του SMS" : "the SMS recipient");

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
          {salonName || manage?.salonName || "\u00a0"}
        </h1>
      </header>

      <div
        ref={chatScrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 shadow-inner"
      >
        {manage === undefined && (
          <p className="text-sm text-zinc-500">{locale === "el" ? "Φόρτωση…" : "Loading…"}</p>
        )}

        {showIdentityGate && (
          <>
            <Bubble role="assistant" text={t.identityAsk(gateName)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void onReturningCustomer()}
                className="rounded-xl border border-violet-300 bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-violet-900"
              >
                {t.imCustomer}
              </button>
              <button
                type="button"
                onClick={() => void onNewCustomer()}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800"
              >
                {t.newCustomer}
              </button>
            </div>
          </>
        )}

        {showManageHome && manage?.booking && (
          <>
            <Bubble
              role="assistant"
              text={
                manage.customerName
                  ? t.welcomeBack(manage.customerName)
                  : t.manageHeading
              }
            />
            <div className="max-w-[85%] rounded-xl border border-violet-100 bg-[var(--primary-soft)] p-3 text-sm text-zinc-800 sm:max-w-full">
              <p className="font-semibold text-violet-800">{t.manageHeading}</p>
              <p>
                {t.service}: {manage.booking.service.name}
              </p>
              <p>
                {t.staffLabel}: {manage.booking.staff.name}
              </p>
              <p>
                {t.time}:{" "}
                {new Date(manage.booking.startsAt).toLocaleString(intlLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <p className="text-xs text-zinc-500">{t.manageDisclaimer}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={manageBusy}
                onClick={() => void onCancelBooking()}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
              >
                {manageBusy ? t.cancelling : t.cancelBooking}
              </button>
              <button
                type="button"
                disabled={manageBusy}
                onClick={() => {
                  setManageView("reschedule");
                  setManageSlot("");
                  setDate(todayStr);
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                {t.rescheduleBooking}
              </button>
            </div>
          </>
        )}

        {showTerminalBooking && manage?.booking && (
          <>
            <Bubble
              role="assistant"
              text={
                manage.uiPhase === "past"
                  ? t.pastBooking
                  : manage.uiPhase === "cancelled"
                    ? t.cancelledBooking
                    : t.completedBooking
              }
            />
            <button
              type="button"
              onClick={() => void onBookAgain()}
              className="w-fit rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {t.bookAgain}
            </button>
          </>
        )}

        {showReschedule && manage?.booking && (
          <>
            <Bubble role="assistant" text={t.rescheduleTitle} />
            <div className="max-w-[85%]">
              <input
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setManageSlot("");
                }}
                type="date"
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm transition focus:border-violet-300"
              />
            </div>
            <Bubble role="assistant" text={t.slots} />
            {manageSlots.length === 0 ? (
              <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">{t.noSlots}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {morningSlots.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t.morning}
                    </h3>
                    <CardGrid>
                      {morningSlots.map((slotIso) => (
                        <button
                          key={slotIso}
                          type="button"
                          onClick={() => setManageSlot(slotIso)}
                          className={choiceClass(manageSlot === slotIso)}
                        >
                          {new Date(slotIso).toLocaleTimeString(intlLocale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </CardGrid>
                  </section>
                )}
                {afternoonSlots.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t.afternoon}
                    </h3>
                    <CardGrid>
                      {afternoonSlots.map((slotIso) => (
                        <button
                          key={slotIso}
                          type="button"
                          onClick={() => setManageSlot(slotIso)}
                          className={choiceClass(manageSlot === slotIso)}
                        >
                          {new Date(slotIso).toLocaleTimeString(intlLocale, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </CardGrid>
                  </section>
                )}
              </div>
            )}
            {manageSlot && (
              <button
                type="button"
                disabled={manageBusy}
                onClick={() => void onConfirmReschedule()}
                className="w-fit rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {manageBusy ? t.rescheduling : t.confirmReschedule}
              </button>
            )}
            <button
              type="button"
              disabled={manageBusy}
              onClick={() => {
                setManageView("home");
                setManageSlot("");
              }}
              className="w-fit text-sm text-zinc-600 underline"
            >
              {locale === "el" ? "Πίσω" : "Back"}
            </button>
          </>
        )}

        {showNormalFlow && !showIdentityGate && !showManageHome && !showTerminalBooking && !showReschedule && (
          <>
            <Bubble
              role="assistant"
              text={
                rebookActive && name.trim()
                  ? t.welcomeBack(name)
                  : identity === "returning" && manage?.customerName && !rebookActive
                    ? t.welcomeBack(manage.customerName)
                    : t.welcome
              }
            />
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

            {hasService && selectedService && !rebookActive && (
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

            {hasService && selectedService && rebookActive && hasStaff && selectedStaff && (
              <Bubble role="user" text={`${selectedService.name} · ${selectedStaff.name}`} />
            )}

            {hasStaff && selectedStaff && (
              <>
                {!rebookActive && <Bubble role="user" text={selectedStaff.name} />}
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
                {slots.length === 0 ? (
                  <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                    {t.noSlots}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {morningSlots.length > 0 && (
                      <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {t.morning}
                        </h3>
                        <CardGrid>
                          {morningSlots.map((slotIso) => (
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
                      </section>
                    )}
                    {afternoonSlots.length > 0 && (
                      <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {t.afternoon}
                        </h3>
                        <CardGrid>
                          {afternoonSlots.map((slotIso) => (
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
                      </section>
                    )}
                  </div>
                )}
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
                  <Bubble role="assistant" text={phoneRetryMessage} tone="error" />
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
          </>
        )}

        {result && (
          <Bubble
            role="assistant"
            text={result}
            tone={
              resultTone === "error"
                ? "error"
                : resultTone === "success"
                  ? "success"
                  : "neutral"
            }
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
