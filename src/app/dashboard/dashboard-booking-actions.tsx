"use client";

import { format } from "date-fns";
import { el, enGB } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import {
  cancelBookingFromDashboard,
  getDashboardRescheduleSlots,
  rescheduleBookingFromDashboard,
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
};

type Props = {
  bookingId: string;
  lang: Locale;
  canCancel: boolean;
  canReschedule: boolean;
  defaultDate: string;
  labels: Labels;
};

export function DashboardBookingActions({
  bookingId,
  lang,
  canCancel,
  canReschedule,
  defaultDate,
  labels,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slotDate, setSlotDate] = useState(defaultDate);
  const [slots, setSlots] = useState<string[] | null>(null);
  const dateFnsLocale = lang === "el" ? el : enGB;

  async function onCancel() {
    if (!canCancel || busy) return;
    if (!window.confirm(labels.confirmCancel)) return;
    setError(null);
    setBusy(true);
    try {
      const r = await cancelBookingFromDashboard(bookingId, lang);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function loadSlots() {
    setError(null);
    setBusy(true);
    setSlots(null);
    try {
      const r = await getDashboardRescheduleSlots(bookingId, slotDate, lang);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSlots(r.slots);
    } finally {
      setBusy(false);
    }
  }

  async function pickSlot(iso: string) {
    setError(null);
    setBusy(true);
    try {
      const r = await rescheduleBookingFromDashboard(bookingId, iso, lang);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDialogOpen(false);
      setSlots(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!canCancel && !canReschedule) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {canReschedule ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDialogOpen(true);
              setSlotDate(defaultDate);
              setSlots(null);
              setError(null);
            }}
            className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {labels.reschedule}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            {labels.cancel}
          </button>
        ) : null}
      </div>
      {error ? <p className="max-w-[14rem] text-xs text-red-600">{labels.errorPrefix} {error}</p> : null}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">{labels.reschedule}</h3>
              <button
                type="button"
                className="text-sm text-zinc-500 hover:text-zinc-800"
                onClick={() => setDialogOpen(false)}
              >
                {labels.close}
              </button>
            </div>
            <label className="mb-2 flex flex-col gap-1 text-xs text-zinc-600">
              {lang === "el" ? "Ημερομηνία" : "Date"}
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={loadSlots}
              className="mb-3 w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? labels.working : labels.loadSlots}
            </button>
            {slots && slots.length === 0 ? (
              <p className="text-sm text-zinc-500">{lang === "el" ? "Κενές ώρες." : "No slots."}</p>
            ) : null}
            {slots && slots.length > 0 ? (
              <div>
                <p className="mb-2 text-xs text-zinc-500">{labels.pickSlot}</p>
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {slots.map((iso) => {
                    const d = new Date(iso);
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={busy}
                        onClick={() => pickSlot(iso)}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
                      >
                        {format(d, "HH:mm", { locale: dateFnsLocale })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
