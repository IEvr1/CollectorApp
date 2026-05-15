"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizePhone } from "@/lib/phone";
import { parseLocale, type Locale } from "@/lib/locale";
import { ANY_AVAILABLE_STAFF_ID } from "@/lib/staff-selection";
import {
  formatSalonDateTimeDisplay,
  formatSalonTime,
  hourInTimeZone,
  localeTagForLang,
  todayIsoInTimeZone,
} from "@/lib/timezone";

type Service = { id: string; name: string; durationMin: number };
type Staff = { id: string; name: string };

type ManageBooking = {
  id: string;
  startsAt: string;
  startsAtDisplay?: string;
  endsAt: string;
  status: string;
  service: { id: string; name: string; durationMin: number };
  staff: { id: string; name: string };
};

type ManageUpcomingBooking = ManageBooking & {
  uiPhase: "manageable" | "past" | "cancelled" | "completed";
  canManage: boolean;
};

type ManageSummary = {
  salonName: string;
  salonTimezone: string;
  customerName: string | null;
  customerPhone: string;
  booking: ManageBooking | null;
  uiPhase: "manageable" | "past" | "cancelled" | "completed" | "no_booking";
  canManage: boolean;
  upcomingBookings?: ManageUpcomingBooking[];
};

const DEFAULT_SALON_TIMEZONE = "Europe/Nicosia";

type SlotOption = { iso: string; label: string };

function slotLabelsFromOptions(options: SlotOption[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const option of options) {
    labels[option.iso] = option.label;
  }
  return labels;
}

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
          phonePh: "Κινητό τηλέφωνο",
          bookingSummary: "Σύνοψη κράτησης",
          service: "Υπηρεσία",
          time: "Ώρα",
          booking: "Καταχώρηση...",
          bookNow: "Κράτηση Ραντεβού",
          missing: "Συμπληρώστε όλα τα πεδία πριν την κράτηση.",
          phoneRetry:
            "Βάλτε 8 ψηφία κυπριακού κινητού (π.χ. 99XXXXXX, 98XXXXXX, χωρίς +357).",
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
          additionalAppointment: "Νέο επιπλέον ραντεβού",
          backToAppointment: "Πίσω στο τρέχον ραντεβού",
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
          manageDisclaimer: "Προσωπικό link — Μην το προωθείτε.",
          staffLabel: "Staff",
          anyAvailableStaff: "Οποιοσδήποτε διαθέσιμος",
          otherAppointments: "Τα επερχόμενα ραντεβού σας",
          switchAppointmentHint:
            "Έχετε και άλλο ενεργό ραντεβού — επιλέξτε το παρακάτω για διαχείριση.",
          linkedExistingSameName:
            "Συνδέσαμε αυτό το ραντεβού με τον υπάρχοντα λογαριασμό σου σε αυτό το κινητό.",
          linkedExistingNameUpdated: "",
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
          phonePh: "Mobile phone",
          bookingSummary: "Booking summary",
          service: "Service",
          time: "Time",
          booking: "Booking...",
          bookNow: "Book Appointment",
          missing: "Please complete all fields before booking.",
          phoneRetry:
            "Enter 8 digits of a Cyprus mobile (e.g. 99XXXXXX, 98XXXXXX, without +357).",
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
          additionalAppointment: "Book another appointment",
          backToAppointment: "Back to current appointment",
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
          anyAvailableStaff: "Any available",
          otherAppointments: "Your upcoming appointments",
          switchAppointmentHint:
            "You have another active appointment — select it below to manage it.",
          linkedExistingSameName:
            "We linked this appointment to your existing account for this number.",
          linkedExistingNameUpdated: "",
        };

  const intlLocale = localeTagForLang(locale);

  const [salonName, setSalonName] = useState("");
  const [salonTimezone, setSalonTimezone] = useState(DEFAULT_SALON_TIMEZONE);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState("");
  const [minBookableDate, setMinBookableDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotLabels, setSlotLabels] = useState<Record<string, string>>({});
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
  const chatContentRef = useRef<HTMLDivElement>(null);
  const bookingRequestInFlightRef = useRef(false);
  const manageRequestInFlightRef = useRef(false);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = chatScrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const scrollChatToBottomAfterPaint = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      window.requestAnimationFrame(() => scrollChatToBottom(behavior));
    },
    [scrollChatToBottom],
  );

  const [manage, setManage] = useState<ManageSummary | null | undefined>(undefined);
  const activeSalonTimezone = manage?.salonTimezone ?? salonTimezone;
  const [identity, setIdentity] = useState<"pending" | "returning" | "new">("returning");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [manageView, setManageView] = useState<"home" | "reschedule">("home");
  const [rebookActive, setRebookActive] = useState(false);
  const [manageSlots, setManageSlots] = useState<string[]>([]);
  const [manageSlotLabels, setManageSlotLabels] = useState<Record<string, string>>({});
  const [manageSlot, setManageSlot] = useState("");
  const [manageBusy, setManageBusy] = useState(false);
  const [focusBusy, setFocusBusy] = useState(false);

  const loadManageSummary = useCallback(async () => {
    const response = await fetch(`/api/bookings/manage/summary?lang=${locale}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      setManage(null);
      return;
    }
    if (!response.ok) {
      setManage(null);
      return;
    }
    const data = (await response.json()) as ManageSummary;
    setManage({
      ...data,
      upcomingBookings: data.upcomingBookings ?? [],
    });
    if (data.booking || data.customerName) {
      if (!identityConfirmed) {
        setIdentity("pending");
      }
    } else {
      setIdentity("returning");
      if (data.customerPhone) {
        setPhone(data.customerPhone);
      }
    }
  }, [identityConfirmed, locale]);

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
    scrollChatToBottom();
  }, [
    scrollChatToBottom,
    serviceId,
    staffId,
    date,
    slot,
    result,
    slots,
    services.length,
    staff.length,
    locale,
    busy,
    phoneRetryMessage,
    manage,
    identity,
    manageView,
    manageSlots,
    manageSlot,
    manageBusy,
    focusBusy,
    rebookActive,
  ]);

  useEffect(() => {
    const root = chatScrollRef.current;
    const content = chatContentRef.current;
    if (!root || !content) {
      return;
    }
    const ro = new ResizeObserver(() => {
      scrollChatToBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollChatToBottom]);

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
      if (typeof data.minBookableDate === "string") {
        setMinBookableDate(data.minBookableDate);
        if (!date) {
          setDate(data.minBookableDate);
        }
      }
      if (typeof data.salon?.timezone === "string") {
        setSalonTimezone(data.salon.timezone);
      }
      setServices(data.services ?? []);
      setStaff(data.staff ?? []);
      const options = (data.slotOptions ?? []) as SlotOption[];
      if (options.length > 0) {
        setSlots(options.map((option) => option.iso));
        setSlotLabels(slotLabelsFromOptions(options));
      } else {
        setSlots(data.slots ?? []);
        setSlotLabels({});
      }
    }

    void load();
  }, [serviceId, staffId, date, locale]);

  useEffect(() => {
    if (minBookableDate === null) {
      return;
    }
    if (date < minBookableDate) {
      setDate(minBookableDate);
      setSlot("");
      setManageSlot("");
    }
  }, [minBookableDate, date]);

  useEffect(() => {
    if (manageView !== "reschedule" || !manage?.booking) {
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/bookings/manage/slots?lang=${locale}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date }),
      });
      const data = await response.json();
      if (!cancelled && response.ok) {
        const options = (data.slotOptions ?? []) as SlotOption[];
        if (options.length > 0) {
          setManageSlots(options.map((option) => option.iso));
          setManageSlotLabels(slotLabelsFromOptions(options));
        } else {
          setManageSlots(data.slots ?? []);
          setManageSlotLabels({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manageView, manage?.booking, date, locale]);

  function selectService(id: string) {
    setServiceId(id);
    setStaffId("");
    setSlot("");
    scrollChatToBottomAfterPaint();
  }

  function selectStaff(id: string) {
    setStaffId(id);
    setSlot("");
    scrollChatToBottomAfterPaint();
  }

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId),
    [services, serviceId],
  );
  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === staffId),
    [staff, staffId],
  );
  const selectedStaffName =
    staffId === ANY_AVAILABLE_STAFF_ID ? t.anyAvailableStaff : (selectedStaff?.name ?? "");

  const { morningSlots, afternoonSlots } = useMemo(() => {
    const source = manageView === "reschedule" ? manageSlots : slots;
    const morning: string[] = [];
    const afternoon: string[] = [];
    for (const slotIso of source) {
      const hour = hourInTimeZone(new Date(slotIso), activeSalonTimezone);
      if (hour < 12) {
        morning.push(slotIso);
      } else {
        afternoon.push(slotIso);
      }
    }
    return { morningSlots: morning, afternoonSlots: afternoon };
  }, [slots, manageSlots, manageView, activeSalonTimezone]);

  const hasService = Boolean(serviceId);
  const hasStaff = Boolean(staffId);
  const hasSlot = Boolean(slot);
  const maskPhoneForManagedRebook =
    rebookActive && identity === "returning" && Boolean(manage?.customerPhone);
  const maskedManagedPhone = maskPhone(phone);

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
    setIdentityConfirmed(true);
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
    setIdentityConfirmed(true);
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

  function onAdditionalAppointment() {
    if (!manage?.booking) {
      return;
    }
    setSalonName(manage.salonName);
    setRebookActive(true);
    setManageView("home");
    setServiceId("");
    setStaffId("");
    setSlot("");
    setSlots([]);
    setManageSlot("");
    setName(manage.customerName ?? "");
    setPhone(manage.customerPhone);
    setDate(todayIsoInTimeZone(activeSalonTimezone));
    setResult("");
    setResultTone("neutral");
    setPhoneRetryMessage(null);
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
    setDate(todayIsoInTimeZone(activeSalonTimezone));
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
    if (manageRequestInFlightRef.current) {
      return;
    }
    if (!window.confirm(t.confirmCancel)) {
      return;
    }
    manageRequestInFlightRef.current = true;
    setManageBusy(true);
    try {
      const response = await fetch("/api/bookings/manage/cancel", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setResult(t.cancelFailed);
        setResultTone("error");
        return;
      }
      setResult(t.cancelledOk);
      setResultTone("success");
      await loadManageSummary();
    } finally {
      setManageBusy(false);
      manageRequestInFlightRef.current = false;
    }
  }

  async function onConfirmReschedule() {
    if (manageRequestInFlightRef.current) {
      return;
    }
    if (!manageSlot) {
      return;
    }
    manageRequestInFlightRef.current = true;
    setManageBusy(true);
    try {
      const response = await fetch("/api/bookings/manage/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ startsAt: manageSlot }),
      });
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
    } finally {
      setManageBusy(false);
      manageRequestInFlightRef.current = false;
    }
  }

  async function bookNow() {
    if (bookingRequestInFlightRef.current) {
      return;
    }
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

    const refreshManageAfterBook = rebookActive && Boolean(manage?.booking);

    bookingRequestInFlightRef.current = true;
    setBusy(true);
    setResult("");
    setResultTone("neutral");
    setPhoneRetryMessage(null);
    try {
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

      const data = (await response.json()) as {
        error?: string;
        code?: string;
        manageUrl?: string;
        linkedExistingCustomer?: boolean;
        nameChanged?: boolean;
      };
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
        return;
      }

      setPhoneRetryMessage(null);
      const linkedNotice =
        data.linkedExistingCustomer === true
          ? data.nameChanged === true
            ? t.linkedExistingNameUpdated
            : t.linkedExistingSameName
          : "";
      setResult(
        `${linkedNotice}${linkedNotice ? "\n\n" : ""}${t.success} ${data.manageUrl ?? ""}`,
      );
      setResultTone("success");
      setRebookActive(false);
      if (refreshManageAfterBook) {
        setServiceId("");
        setStaffId("");
        setSlot("");
        await loadManageSummary();
      }
    } finally {
      setBusy(false);
      bookingRequestInFlightRef.current = false;
    }
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

  const upcomingSwitcher = useMemo(() => {
    if (!manage) {
      return { show: false, upcoming: [] as ManageUpcomingBooking[] };
    }
    const upcoming = manage.upcomingBookings ?? [];
    const focusId = manage.booking?.id;
    const show =
      upcoming.length > 1 ||
      (upcoming.length === 1 && focusId !== undefined && upcoming[0].id !== focusId);
    return { show, upcoming };
  }, [manage]);

  async function onFocusBooking(bookingId: string) {
    const focusedId = manage?.booking?.id;
    const upcoming = manage?.upcomingBookings ?? [];
    const inUpcomingList = focusedId !== undefined && upcoming.some((u) => u.id === focusedId);
    const redundantFocus =
      bookingId === focusedId && manage?.uiPhase === "manageable" && inUpcomingList;
    if (redundantFocus) {
      return;
    }
    setFocusBusy(true);
    try {
      const response = await fetch("/api/bookings/manage/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bookingId }),
      });
      if (!response.ok) {
        setResult(locale === "el" ? "Η εναλλαγή ραντεβού απέτυχε." : "Could not switch appointment.");
        setResultTone("error");
        return;
      }
      setManageView("home");
      setManageSlot("");
      await loadManageSummary();
    } finally {
      setFocusBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col px-4 py-6">
      <header className="mb-4 shrink-0">
        <div className="flex justify-end">
          <div className="flex rounded-xl border border-zinc-200 bg-white/90 p-1 text-xs font-medium shadow-sm">
            <button
              type="button"
              onClick={() => setLocale("el")}
              className={`rounded-lg px-2.5 py-1 transition ${
                locale === "el"
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-700 hover:text-violet-700"
              }`}
            >
              EL
            </button>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-lg px-2.5 py-1 transition ${
                locale === "en"
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-700 hover:text-violet-700"
              }`}
            >
              EN
            </button>
          </div>
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">
          {salonName || manage?.salonName || "\u00a0"}
        </h1>
      </header>

      <div
        ref={chatScrollRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
      >
        <div ref={chatContentRef} className="flex flex-col gap-3">
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
            {upcomingSwitcher.show && (
              <ManageUpcomingSwitcher
                manage={manage}
                upcoming={upcomingSwitcher.upcoming}
                intlLocale={intlLocale}
                salonTimezone={activeSalonTimezone}
                label={t.otherAppointments}
                disabled={focusBusy || manageBusy}
                onSelect={(id) => void onFocusBooking(id)}
              />
            )}
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
                {manage.booking.startsAtDisplay ??
                  formatSalonDateTimeDisplay(
                    new Date(manage.booking.startsAt),
                    activeSalonTimezone,
                    intlLocale,
                  )}
              </p>
            </div>
            <p className="text-xs text-zinc-500">{t.manageDisclaimer}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
                  setResult("");
                  setResultTone("neutral");
                  setManageView("reschedule");
                  setManageSlot("");
                  setDate(todayIsoInTimeZone(activeSalonTimezone));
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                {t.rescheduleBooking}
              </button>
              <button
                type="button"
                disabled={manageBusy}
                onClick={() => onAdditionalAppointment()}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
              >
                {t.additionalAppointment}
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
            {upcomingSwitcher.show && (
              <>
                <p className="text-sm text-zinc-600">{t.switchAppointmentHint}</p>
                <ManageUpcomingSwitcher
                  manage={manage}
                  upcoming={upcomingSwitcher.upcoming}
                  intlLocale={intlLocale}
                  salonTimezone={activeSalonTimezone}
                  label={t.otherAppointments}
                  disabled={focusBusy || manageBusy}
                  onSelect={(id) => void onFocusBooking(id)}
                />
              </>
            )}
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
            {upcomingSwitcher.show && (
              <ManageUpcomingSwitcher
                manage={manage}
                upcoming={upcomingSwitcher.upcoming}
                intlLocale={intlLocale}
                salonTimezone={activeSalonTimezone}
                label={t.otherAppointments}
                disabled={focusBusy || manageBusy}
                onSelect={(id) => void onFocusBooking(id)}
              />
            )}
            <Bubble role="assistant" text={t.rescheduleTitle} />
            <div className="max-w-[85%]">
              <input
                value={date}
                min={
                  manage?.salonTimezone
                    ? todayIsoInTimeZone(manage.salonTimezone)
                    : (minBookableDate ?? undefined)
                }
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
                          onClick={() => {
                            setManageSlot(slotIso);
                            scrollChatToBottomAfterPaint();
                          }}
                          className={choiceClass(manageSlot === slotIso)}
                        >
                          {manageSlotLabels[slotIso] ??
                            formatSalonTime(new Date(slotIso), activeSalonTimezone, intlLocale)}
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
                          onClick={() => {
                            setManageSlot(slotIso);
                            scrollChatToBottomAfterPaint();
                          }}
                          className={choiceClass(manageSlot === slotIso)}
                        >
                          {manageSlotLabels[slotIso] ??
                            formatSalonTime(new Date(slotIso), activeSalonTimezone, intlLocale)}
                        </button>
                      ))}
                    </CardGrid>
                  </section>
                )}
              </div>
            )}
            {manageSlot && (
              <>
                <Bubble
                  role="user"
                  text={formatSalonDateTimeDisplay(
                    new Date(manageSlot),
                    activeSalonTimezone,
                    intlLocale,
                  )}
                />
                <div className="max-w-[85%] rounded-xl border border-violet-100 bg-[var(--primary-soft)] p-3 text-sm text-zinc-800 sm:max-w-full">
                  <p className="font-semibold text-violet-800">{t.bookingSummary}</p>
                  <p>
                    {t.service}: {manage.booking.service.name}
                  </p>
                  <p>
                    {t.staffLabel}: {manage.booking.staff.name}
                  </p>
                  <p>
                    {t.time}:{" "}
                    {formatSalonDateTimeDisplay(
                      new Date(manageSlot),
                      activeSalonTimezone,
                      intlLocale,
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={manageBusy}
                  onClick={() => void onConfirmReschedule()}
                  className="w-fit rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {manageBusy ? t.rescheduling : t.confirmReschedule}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={manageBusy}
              onClick={() => {
                setResult("");
                setResultTone("neutral");
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
            {rebookActive && manage?.booking && (
              <button
                type="button"
                onClick={() => {
                  setRebookActive(false);
                  setServiceId("");
                  setStaffId("");
                  setSlot("");
                  setResult("");
                  setResultTone("neutral");
                  setPhoneRetryMessage(null);
                }}
                className="w-fit text-sm text-zinc-600 underline"
              >
                {t.backToAppointment}
              </button>
            )}
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

            {hasService && selectedService && <Bubble role="user" text={selectedService.name} />}

            {hasService && selectedService && <Bubble role="assistant" text={t.pickStaff} />}

            {hasService && selectedService && !hasStaff && (
                <CardGrid>
                  <button
                    type="button"
                    onClick={() => selectStaff(ANY_AVAILABLE_STAFF_ID)}
                    className={choiceClass(false)}
                  >
                    {t.anyAvailableStaff}
                  </button>
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

            {hasStaff && selectedStaffName && (
              <>
                <Bubble role="user" text={selectedStaffName} />
                <Bubble role="assistant" text={t.pickDate} />
                <div className="max-w-[85%]">
                  <input
                    value={date}
                    min={minBookableDate ?? undefined}
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
                              onClick={() => {
                                setSlot(slotIso);
                                scrollChatToBottomAfterPaint();
                              }}
                              className={choiceClass(slot === slotIso)}
                            >
                              {slotLabels[slotIso] ??
                                formatSalonTime(new Date(slotIso), activeSalonTimezone, intlLocale)}
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
                              onClick={() => {
                                setSlot(slotIso);
                                scrollChatToBottomAfterPaint();
                              }}
                              className={choiceClass(slot === slotIso)}
                            >
                              {slotLabels[slotIso] ??
                                formatSalonTime(new Date(slotIso), activeSalonTimezone, intlLocale)}
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
                  text={formatSalonDateTimeDisplay(new Date(slot), activeSalonTimezone, intlLocale)}
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
                    value={maskPhoneForManagedRebook ? maskedManagedPhone : phone}
                    onChange={(event) => {
                      if (maskPhoneForManagedRebook) {
                        return;
                      }
                      setPhone(event.target.value);
                      setPhoneRetryMessage(null);
                    }}
                    placeholder={t.phonePh}
                    readOnly={maskPhoneForManagedRebook}
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
                    {slot
                      ? formatSalonDateTimeDisplay(new Date(slot), activeSalonTimezone, intlLocale)
                      : "-"}
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

        {result && !showReschedule && (
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
    </div>
  );
}

function ManageUpcomingSwitcher({
  manage,
  upcoming,
  intlLocale,
  salonTimezone,
  label,
  disabled,
  onSelect,
}: {
  manage: ManageSummary;
  upcoming: ManageUpcomingBooking[];
  intlLocale: string;
  salonTimezone: string;
  label: string;
  disabled: boolean;
  onSelect: (bookingId: string) => void;
}) {
  const focusId = manage.booking?.id;
  const focusInUpcoming =
    focusId !== undefined && upcoming.some((u) => u.id === focusId);

  return (
    <div className="max-w-[85%] rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-800 shadow-sm sm:max-w-full">
      <p className="mb-2 font-medium text-zinc-800">{label}</p>
      <div className="flex flex-col gap-2">
        {upcoming.map((b) => {
          const isSelected = focusInUpcoming && b.id === focusId;
          const redundant =
            b.id === focusId && manage.uiPhase === "manageable" && focusInUpcoming;
          return (
            <button
              key={b.id}
              type="button"
              disabled={disabled || redundant}
              onClick={() => onSelect(b.id)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? "border-violet-300 bg-[var(--primary-soft)] text-violet-900 ring-2 ring-violet-200"
                  : "border-zinc-300 bg-white hover:border-violet-300 hover:bg-violet-50/40"
              } ${disabled || redundant ? "opacity-60" : ""}`}
            >
              <span className="font-medium">
                {b.startsAtDisplay ??
                  formatSalonDateTimeDisplay(new Date(b.startsAt), salonTimezone, intlLocale)}
              </span>
              <span className="mt-0.5 block text-zinc-600">
                {b.service.name} · {b.staff.name}
              </span>
            </button>
          );
        })}
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

function maskPhone(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length <= 3) {
    return digitsOnly;
  }
  return `${"*".repeat(digitsOnly.length - 3)}${digitsOnly.slice(-3)}`;
}
