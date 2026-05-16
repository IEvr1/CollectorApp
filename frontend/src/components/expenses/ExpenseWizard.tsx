import { useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

const CATEGORIES = [
  "electricity",
  "water",
  "elevator",
  "cleaning",
  "insurance",
  "reserve",
  "other",
] as const;

interface PreviewRow {
  unit_number: string;
  area_m2: number;
  share: number;
  charge: number;
}

export function ExpenseWizard({
  buildingId,
  units,
  totalArea,
  onClose,
  onSuccess,
}: {
  buildingId: string;
  units: { id: string; unit_number: string; area_m2: number }[];
  totalArea: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "electricity" as (typeof CATEGORIES)[number],
    vendor: "",
    amount: "",
  });

  const amount = parseFloat(form.amount) || 0;
  const preview: PreviewRow[] =
    totalArea > 0
      ? units.map((u) => {
          const share = u.area_m2 / totalArea;
          return {
            unit_number: u.unit_number,
            area_m2: u.area_m2,
            share: share * 100,
            charge: Math.round(amount * share * 100) / 100,
          };
        })
      : [];

  const previewTotal = preview.reduce((s, r) => s + r.charge, 0);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post(`/buildings/${buildingId}/expenses`, {
        date: form.date,
        category: form.category,
        vendor: form.vendor || null,
        amount,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">{t("addExpense")}</h2>
          <p className="text-sm text-slate-500">
            {t("preview")} — βήμα {step}/3
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4 p-6">
            <label className="block text-sm font-medium">
              {t("date")}
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("category")}
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as typeof form.category })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              {t("vendor")}
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("amount")} (€)
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="p-6">
            {totalArea <= 0 ? (
              <p className="text-overdue text-sm">Προσθέστε διαμερίσματα με εμβαδόν πριν την κατανομή.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2">Διαμ.</th>
                    <th className="pb-2">m²</th>
                    <th className="pb-2">%</th>
                    <th className="pb-2 text-right">€</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.unit_number} className="border-b border-slate-100">
                      <td className="py-2">{r.unit_number}</td>
                      <td>{r.area_m2}</td>
                      <td>{r.share.toFixed(1)}%</td>
                      <td className="text-right tabular-nums">{r.charge.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-2 font-medium">
                      Σύνολο
                    </td>
                    <td className="pt-2 text-right font-bold tabular-nums">
                      {previewTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="mt-4 text-sm text-slate-600">
              Θα σταλούν SMS και email σε {units.length} ιδιοκτήτες.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 text-center">
            <p className="text-slate-700">Επιβεβαιώστε κατανομή €{amount.toFixed(2)};</p>
            {error && <p className="mt-2 text-sm text-overdue">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t("cancel")}
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t("back")}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              disabled={amount <= 0 || (step === 2 && totalArea <= 0)}
              onClick={() => setStep(step + 1)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {t("next")}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="rounded-lg bg-paid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t("loading") : t("distribute")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
