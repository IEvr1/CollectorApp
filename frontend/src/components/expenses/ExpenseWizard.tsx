import { useState } from "react";
import { api } from "@/lib/api";
import { categoryLabel, t } from "@/lib/i18n";
import type { SplitMethod } from "@/lib/i18n";

const CATEGORIES = ["maintenance", "utilities", "dues", "event", "insurance", "other"] as const;

interface PreviewRow {
  unit_number: string;
  detail: string;
  share: number;
  charge: number;
}

function computePreview(
  amount: number,
  units: { unit_number: string; area_m2?: number | null; weight?: number }[],
  splitMethod: SplitMethod,
  totalArea: number
): PreviewRow[] {
  if (amount <= 0 || units.length === 0) return [];

  const totalWeight = units.reduce((s, u) => s + (u.weight ?? 1), 0);

  return units.map((u) => {
    let share = 0;
    let charge = 0;
    let detail = "";

    if (splitMethod === "equal") {
      share = 100 / units.length;
      charge = Math.round((amount / units.length) * 100) / 100;
      detail = "1/" + units.length;
    } else if (splitMethod === "custom_weight") {
      const w = u.weight ?? 1;
      share = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
      charge = totalWeight > 0 ? Math.round(amount * (w / totalWeight) * 100) / 100 : 0;
      detail = String(w);
    } else {
      const area = u.area_m2 ?? 0;
      share = totalArea > 0 ? (area / totalArea) * 100 : 0;
      charge = totalArea > 0 ? Math.round(amount * (area / totalArea) * 100) / 100 : 0;
      detail = `${area} m²`;
    }

    return { unit_number: u.unit_number, detail, share, charge };
  });
}

function canPreview(splitMethod: SplitMethod, units: unknown[], totalArea: number): boolean {
  if (units.length === 0) return false;
  if (splitMethod === "equal" || splitMethod === "custom_weight") return true;
  return totalArea > 0;
}

export function ExpenseWizard({
  groupId,
  splitMethod,
  units,
  totalArea,
  onClose,
  onSuccess,
}: {
  groupId: string;
  splitMethod: SplitMethod;
  units: { id: string; unit_number: string; area_m2?: number | null; weight?: number }[];
  totalArea: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "utilities" as (typeof CATEGORIES)[number],
    vendor: "",
    amount: "",
  });

  const amount = parseFloat(form.amount) || 0;
  const preview = computePreview(amount, units, splitMethod, totalArea);
  const previewTotal = preview.reduce((s, r) => s + r.charge, 0);
  const previewReady = canPreview(splitMethod, units, totalArea);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post(`/groups/${groupId}/expenses`, {
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

  const detailHeader =
    splitMethod === "equal" ? t("share") : splitMethod === "custom_weight" ? t("weight") : "m²";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">{t("addExpense")}</h2>
          <p className="text-sm text-slate-500">
            {t("preview")} — {step}/3
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
                    {categoryLabel(c)}
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
            {!previewReady ? (
              <p className="text-sm text-overdue">{t("members")} — configuration required for split.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2">#</th>
                    <th className="pb-2">{detailHeader}</th>
                    <th className="pb-2">%</th>
                    <th className="pb-2 text-right">€</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.unit_number} className="border-b border-slate-100">
                      <td className="py-2">{r.unit_number}</td>
                      <td>{r.detail}</td>
                      <td>{r.share.toFixed(1)}%</td>
                      <td className="text-right tabular-nums">{r.charge.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-2 font-medium">
                      Total
                    </td>
                    <td className="pt-2 text-right font-bold tabular-nums">{previewTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <p className="mt-4 text-sm text-slate-600">
              SMS + email → {units.length} {t("members").toLowerCase()}
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 text-center">
            <p className="text-slate-700">€{amount.toFixed(2)}?</p>
            {error && <p className="mt-2 text-sm text-overdue">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t("cancel")}
          </button>
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              {t("back")}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              disabled={amount <= 0 || (step === 2 && !previewReady)}
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
