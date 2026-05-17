import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, type BuildingDashboard, type Expense } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { UnitCard } from "@/components/units/UnitCard";
import { UnitDrawer } from "@/components/units/UnitDrawer";
import { ExpenseWizard } from "@/components/expenses/ExpenseWizard";
import { t } from "@/lib/i18n";
import type { UnitWithLedger } from "@/lib/api";

type Filter = "all" | "paid" | "pending" | "overdue";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function BuildingPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BuildingDashboard | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"units" | "expenses" | "payments">("units");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedUnit, setSelectedUnit] = useState<UnitWithLedger | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState({
    unit_number: "",
    owner_name: "",
    email: "",
    phone: "",
    area_m2: "",
  });

  const load = useCallback(async () => {
    if (!id) return;
    const dash = await api.get<BuildingDashboard>(`/buildings/${id}/dashboard`);
    setData(dash);
    const exp = await api.get<Expense[]>(`/buildings/${id}/expenses`);
    setExpenses(exp);
  }, [id]);

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  useEffect(() => {
    const client = supabase;
    if (!client || !id) return;
    const channel = client
      .channel(`building-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger", filter: `building_id=eq.${id}` },
        (payload) => {
          load();
          const unitId = (payload.new as { unit_id?: string })?.unit_id;
          if (unitId) {
            setHighlightId(unitId);
            toast.success("Ενημέρωση κατάστασης — νέα πληρωμή");
            setTimeout(() => setHighlightId(null), 3000);
          }
        }
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [id, load]);

  if (!data) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  const filteredUnits = data.units.filter((u) => {
    if (filter === "all") return true;
    if (filter === "paid") return u.status === "paid";
    if (filter === "pending") return u.status === "pending";
    return u.status === "overdue" || u.status === "escalated";
  });

  const addUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/buildings/${id}/units`, {
      unit_number: unitForm.unit_number,
      owner_name: unitForm.owner_name || null,
      email: unitForm.email || null,
      phone: unitForm.phone || null,
      area_m2: parseFloat(unitForm.area_m2),
    });
    setShowUnitForm(false);
    setUnitForm({ unit_number: "", owner_name: "", email: "", phone: "", area_m2: "" });
    load();
    toast.success("Διαμέρισμα προστέθηκε");
  };

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        {t("home")}
      </Link>

      <h1 className="text-2xl font-bold">{data.building.name}</h1>
      {data.building.address && <p className="text-slate-500">{data.building.address}</p>}

      <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">{t("collected")}</p>
          <p className="text-xl font-bold tabular-nums">{formatEuro(Number(data.collected_this_month))}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t("outstanding")}</p>
          <p className="text-xl font-bold tabular-nums text-overdue">
            {formatEuro(Number(data.outstanding))}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t("units")}</p>
          <p className="text-xl font-bold">
            {data.units_paid}/{data.units_total} {t("statusPaid").toLowerCase()}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200">
        {(["units", "expenses", "payments"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
            }`}
          >
            {t(key === "units" ? "units" : key === "expenses" ? "expenses" : "payments")}
          </button>
        ))}
      </div>

      {tab === "units" && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {(["all", "paid", "pending", "overdue"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-sm ${
                    filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f === "all"
                    ? t("all")
                    : f === "paid"
                      ? t("statusPaid")
                      : f === "pending"
                        ? t("statusPending")
                        : t("statusOverdue")}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUnitForm(true)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                + {t("unitNumber")}
              </button>
              <button
                type="button"
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <Plus className="h-4 w-4" />
                {t("addExpense")}
              </button>
            </div>
          </div>

          {showUnitForm && (
            <form onSubmit={addUnit} className="mt-4 grid gap-2 rounded-lg border bg-white p-4 sm:grid-cols-5">
              <input
                required
                placeholder={t("unitNumber")}
                className="rounded border px-2 py-1.5 text-sm"
                value={unitForm.unit_number}
                onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
              />
              <input
                placeholder={t("ownerName")}
                className="rounded border px-2 py-1.5 text-sm"
                value={unitForm.owner_name}
                onChange={(e) => setUnitForm({ ...unitForm, owner_name: e.target.value })}
              />
              <input
                placeholder={t("email")}
                className="rounded border px-2 py-1.5 text-sm"
                value={unitForm.email}
                onChange={(e) => setUnitForm({ ...unitForm, email: e.target.value })}
              />
              <input
                placeholder={t("phone")}
                className="rounded border px-2 py-1.5 text-sm"
                value={unitForm.phone}
                onChange={(e) => setUnitForm({ ...unitForm, phone: e.target.value })}
              />
              <input
                required
                placeholder={t("area")}
                type="number"
                className="rounded border px-2 py-1.5 text-sm"
                value={unitForm.area_m2}
                onChange={(e) => setUnitForm({ ...unitForm, area_m2: e.target.value })}
              />
              <button type="submit" className="rounded bg-paid px-3 py-1.5 text-sm text-white sm:col-span-5">
                {t("confirm")}
              </button>
            </form>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUnits.map((u) => (
              <UnitCard
                key={u.id}
                unit={u}
                highlighted={highlightId === u.id}
                onClick={() => setSelectedUnit(u)}
              />
            ))}
          </div>
        </>
      )}

      {tab === "expenses" && (
        <ul className="mt-4 space-y-2">
          {expenses.map((e) => (
            <li key={e.id} className="flex justify-between rounded-lg border bg-white px-4 py-3">
              <span>
                {e.date} — {e.category} {e.vendor && `(${e.vendor})`}
              </span>
              <span className="font-medium tabular-nums">€{Number(e.amount).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "payments" && <PaymentsTab buildingId={id!} />}

      {selectedUnit && id && (
        <UnitDrawer unit={selectedUnit} buildingId={id} onClose={() => setSelectedUnit(null)} />
      )}

      {showWizard && id && (
        <ExpenseWizard
          buildingId={id}
          units={data.units}
          totalArea={Number(data.building.total_area_m2) || 0}
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            load();
            toast.success("Έξοδο κατανεμήθηκε");
          }}
        />
      )}
    </div>
  );
}

function PaymentsTab({ buildingId }: { buildingId: string }) {
  const [payments, setPayments] = useState<
    {
      id: string;
      amount: number;
      received_at: string;
      matched: boolean;
      payment_method?: string;
      units?: { unit_number: string };
    }[]
  >([]);

  useEffect(() => {
    api.get<typeof payments>(`/buildings/${buildingId}/payments`).then(setPayments);
  }, [buildingId]);

  return (
    <ul className="mt-4 space-y-2">
      {payments.map((p) => (
        <li key={p.id} className="flex justify-between rounded-lg border bg-white px-4 py-3 text-sm">
          <span>
            {new Date(p.received_at).toLocaleString("el-CY")} — Διαμ. {p.units?.unit_number ?? "?"}
            <span className="ml-2 text-slate-400">
              {p.payment_method === "payment_link" ? t("paymentMethodLink") : t("paymentMethodBank")}
            </span>
            {p.matched ? " ✓" : " (unmatched)"}
          </span>
          <span className="font-medium">€{Number(p.amount).toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
