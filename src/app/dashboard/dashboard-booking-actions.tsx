"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import {
  sendCalendarOnlyRescheduleRequestFromDashboard,
  sendRescheduleRequestFromDashboard,
} from "@/app/dashboard/actions";

type Labels = {
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
  bookingId: string;
  lang: Locale;
  canCancel: boolean;
  canReschedule: boolean;
  defaultDate: string;
  labels: Labels;
};

export type CalendarOnlyRescheduleDetails = {
  calendarId: string;
  googleEventId: string;
  staffId: string;
  serviceName: string;
  customerName: string;
  phoneE164: string;
  startsAtIso: string;
  endsAtIso: string;
};

export function DashboardBookingActions({
  bookingId,
  lang,
  canReschedule,
  labels,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSendRescheduleRequest() {
    if (!canReschedule || busy || sent) return;
    setError(null);
    setBusy(true);
    try {
      const r = await sendRescheduleRequestFromDashboard(bookingId, lang);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSent(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canReschedule) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || sent}
          onClick={onSendRescheduleRequest}
          className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
        >
          {busy ? labels.working : sent ? labels.requestSent : labels.reschedule}
        </button>
      </div>
      {error ? <p className="max-w-[14rem] text-xs text-red-600">{labels.errorPrefix} {error}</p> : null}
    </div>
  );
}

export function DashboardCalendarOnlyActions({
  lang,
  details,
  labels,
}: {
  lang: Locale;
  details: CalendarOnlyRescheduleDetails;
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const hasPhone = details.phoneE164.trim() && details.phoneE164 !== "—";

  async function onSendRescheduleRequest() {
    if (!hasPhone || busy || sent) return;
    setError(null);
    setBusy(true);
    try {
      const r = await sendCalendarOnlyRescheduleRequestFromDashboard(details, lang);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSent(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!hasPhone) {
    return <span className="text-xs text-zinc-400">{labels.calendarOnlyMissingPhone}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy || sent}
        onClick={onSendRescheduleRequest}
        className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
      >
        {busy ? labels.working : sent ? labels.requestSent : labels.reschedule}
      </button>
      {error ? <p className="max-w-[14rem] text-xs text-red-600">{labels.errorPrefix} {error}</p> : null}
    </div>
  );
}
