"use client";

import { useState } from "react";
import type { Locale } from "@/lib/locale";

type Option = { id: string; name: string };

const STATUSES = ["CONFIRMED", "CANCELLED"] as const;

type Props = {
  lang: Locale;
  staff: Option[];
  services: Option[];
  values: {
    date: string;
    staffId: string;
    serviceId: string;
    status: string;
    phone: string;
    view: "list" | "grouped";
  };
  labels: {
    date: string;
    staff: string;
    service: string;
    status: string;
    phone: string;
    view: string;
    list: string;
    grouped: string;
    all: string;
    apply: string;
  };
};

export function DashboardFilters({ lang, staff, services, values, labels }: Props) {
  const [open, setOpen] = useState(false);
  const langParam = lang === "en" ? "en" : "";
  const activeFilters = [
    values.staffId ? labels.staff : null,
    values.serviceId ? labels.service : null,
    values.status !== "all" ? labels.status : null,
    values.phone ? labels.phone : null,
    values.view === "list" ? labels.view : null,
  ].filter(Boolean);
  const activeSummary =
    activeFilters.length > 0
      ? lang === "el"
        ? `${activeFilters.length} ενεργά φίλτρα`
        : `${activeFilters.length} active filters`
      : lang === "el"
        ? "Χωρίς επιπλέον φίλτρα"
        : "No extra filters";
  const toggleLabel = open
    ? lang === "el"
      ? "Απόκρυψη φίλτρων"
      : "Hide filters"
    : lang === "el"
      ? "Εμφάνιση φίλτρων"
      : "Show filters";

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
            {lang === "el" ? "Φίλτρα πίνακα" : "Table filters"}
          </p>
          <p className="text-sm text-zinc-600">
            {values.date} · {activeSummary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-violet-700"
          aria-expanded={open}
        >
          {toggleLabel}
        </button>
      </div>

      {open ? (
        <form method="get" className="mt-4 flex flex-col flex-wrap gap-3 md:flex-row md:items-end">
          {lang === "en" ? <input type="hidden" name="lang" value="en" /> : null}

          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.date}
            <input
              type="date"
              name="date"
              defaultValue={values.date}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>

          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.staff}
            <select
              name="staffId"
              defaultValue={values.staffId}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="">{labels.all}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.service}
            <select
              name="serviceId"
              defaultValue={values.serviceId}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="">{labels.all}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[9rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.status}
            <select
              name="status"
              defaultValue={values.status}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="all">{labels.all}</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.phone}
            <input
              type="search"
              name="phone"
              defaultValue={values.phone}
              placeholder="+357…"
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>

          <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-zinc-600">
            {labels.view}
            <select
              name="view"
              defaultValue={values.view}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="grouped">{labels.grouped}</option>
              <option value="list">{labels.list}</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-violet-700"
          >
            {labels.apply}
          </button>

          <a
            href={`/dashboard${langParam ? `?lang=${langParam}` : ""}`}
            className="text-sm text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
          >
            {lang === "el" ? "Επαναφορά" : "Reset"}
          </a>
        </form>
      ) : null}
    </section>
  );
}
