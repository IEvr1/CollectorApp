import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  type Expense,
  type GroupDashboard,
  type PaymentRow,
  type PayoutBatch,
  type PayoutRunResult,
  type PayoutSummary,
} from "@/lib/api";
import { UnitCard } from "@/components/units/UnitCard";
import { UnitDrawer } from "@/components/units/UnitDrawer";
import { ExpenseWizard } from "@/components/expenses/ExpenseWizard";
import {
  categoryLabel,
  groupTypeLabel,
  memberNumberLabel,
  splitMethodLabel,
  t,
} from "@/lib/i18n";
import type { MemberWithLedger } from "@/lib/api";
import type { GroupType, SplitMethod } from "@/lib/i18n";

type Filter = "all" | "paid" | "pending" | "overdue";
type Tab = "members" | "charges" | "collections" | "payouts";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<GroupDashboard | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<Tab>("members");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedUnit, setSelectedUnit] = useState<MemberWithLedger | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState({
    unit_number: "",
    owner_name: "",
    email: "",
    phone: "",
    area_m2: "",
    weight: "1",
  });

  const load = useCallback(async () => {
    if (!id) return;
    const dash = await api.get<GroupDashboard>(`/groups/${id}/dashboard`);
    setData(dash);
    const exp = await api.get<Expense[]>(`/groups/${id}/expenses`);
    setExpenses(exp);
  }, [id]);

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id, load]);

  if (!data) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  const group = data.building;
  const groupType = (group.group_type ?? "building") as GroupType;
  const splitMethod = (group.split_method ?? "by_area") as SplitMethod;
  const needsArea = splitMethod === "by_area";
  const needsWeight = splitMethod === "custom_weight";

  const filteredUnits = data.units.filter((u) => {
    if (filter === "all") return true;
    if (filter === "paid") return u.status === "paid";
    if (filter === "pending") return u.status === "pending";
    return u.status === "overdue" || u.status === "escalated";
  });

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/groups/${id}/units`, {
      unit_number: memberForm.unit_number,
      owner_name: memberForm.owner_name || null,
      email: memberForm.email || null,
      phone: memberForm.phone || null,
      area_m2: needsArea ? parseFloat(memberForm.area_m2) : null,
      weight: parseFloat(memberForm.weight) || 1,
    });
    setShowMemberForm(false);
    setMemberForm({ unit_number: "", owner_name: "", email: "", phone: "", area_m2: "", weight: "1" });
    load();
    toast.success(t("members"));
  };

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        {t("home")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.address && <p className="text-slate-500">{group.address}</p>}
          <p className="mt-1 text-sm text-slate-500">
            {groupTypeLabel(groupType)} · {splitMethodLabel(splitMethod)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm text-slate-500">{t("outstanding")}</p>
          <p className="text-xl font-bold tabular-nums text-overdue">{formatEuro(Number(data.outstanding))}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t("heldForPayout")}</p>
          <p className="text-xl font-bold tabular-nums">{formatEuro(Number(data.pending_payout))}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t("collected")}</p>
          <p className="text-xl font-bold tabular-nums">{formatEuro(Number(data.collected_this_month))}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t("nextPayout")}</p>
          <p className="text-xl font-bold">{data.next_payout_label}</p>
          {data.last_payout_amount != null && (
            <p className="text-xs text-slate-500">
              {t("lastPayout")}: {formatEuro(Number(data.last_payout_amount))}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200">
        {(
          [
            ["members", "members"],
            ["charges", "charges"],
            ["collections", "collections"],
            ["payouts", "payouts"],
          ] as const
        ).map(([key, labelKey]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {tab === "members" && (
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
                onClick={() => setShowMemberForm(true)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                + {memberNumberLabel(groupType)}
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

          {showMemberForm && (
            <form onSubmit={addMember} className="mt-4 grid gap-2 rounded-lg border bg-white p-4 sm:grid-cols-6">
              <input
                required
                placeholder={memberNumberLabel(groupType)}
                className="rounded border px-2 py-1.5 text-sm"
                value={memberForm.unit_number}
                onChange={(e) => setMemberForm({ ...memberForm, unit_number: e.target.value })}
              />
              <input
                placeholder={t("ownerName")}
                className="rounded border px-2 py-1.5 text-sm"
                value={memberForm.owner_name}
                onChange={(e) => setMemberForm({ ...memberForm, owner_name: e.target.value })}
              />
              <input
                placeholder={t("email")}
                className="rounded border px-2 py-1.5 text-sm"
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
              />
              <input
                placeholder={t("phone")}
                className="rounded border px-2 py-1.5 text-sm"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
              />
              {needsArea && (
                <input
                  required
                  placeholder={t("area")}
                  type="number"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={memberForm.area_m2}
                  onChange={(e) => setMemberForm({ ...memberForm, area_m2: e.target.value })}
                />
              )}
              {needsWeight && (
                <input
                  required
                  placeholder={t("weight")}
                  type="number"
                  step="0.1"
                  className="rounded border px-2 py-1.5 text-sm"
                  value={memberForm.weight}
                  onChange={(e) => setMemberForm({ ...memberForm, weight: e.target.value })}
                />
              )}
              <button type="submit" className="rounded bg-paid px-3 py-1.5 text-sm text-white sm:col-span-6">
                {t("confirm")}
              </button>
            </form>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUnits.map((u) => (
              <UnitCard key={u.id} unit={u} onClick={() => setSelectedUnit(u)} />
            ))}
          </div>
        </>
      )}

      {tab === "charges" && (
        <ul className="mt-4 space-y-2">
          {expenses.map((e) => (
            <li key={e.id} className="flex justify-between rounded-lg border bg-white px-4 py-3">
              <span>
                {e.date} — {categoryLabel(e.category)} {e.vendor && `(${e.vendor})`}
              </span>
              <span className="font-medium tabular-nums">{formatEuro(Number(e.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      {tab === "collections" && id && <CollectionsTab groupId={id} />}
      {tab === "payouts" && id && <PayoutsTab groupId={id} onUpdated={load} />}

      {selectedUnit && id && (
        <UnitDrawer unit={selectedUnit} groupId={id} onClose={() => setSelectedUnit(null)} />
      )}

      {showWizard && id && (
        <ExpenseWizard
          groupId={id}
          splitMethod={splitMethod}
          units={data.units}
          totalArea={Number(group.total_area_m2) || 0}
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            load();
            toast.success(t("distribute"));
          }}
        />
      )}
    </div>
  );
}

function CollectionsTab({ groupId }: { groupId: string }) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    api.get<PaymentRow[]>(`/groups/${groupId}/payments`).then(setPayments);
    const interval = setInterval(() => {
      api.get<PaymentRow[]>(`/groups/${groupId}/payments`).then(setPayments);
    }, 10000);
    return () => clearInterval(interval);
  }, [groupId]);

  function paymentStatus(p: PaymentRow): string {
    if (!p.matched) return t("statusUnmatched");
    if (p.paid_out_at) return t("statusPaidOut");
    if (p.collected_at) return t("statusHeld");
    return t("statusPending");
  }

  return (
    <ul className="mt-4 space-y-2">
      {payments.length === 0 && <li className="text-sm text-slate-500">{t("loading")}</li>}
      {payments.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 text-sm">
          <span>
            {new Date(p.received_at).toLocaleString("el-CY")} — {p.units?.unit_number ?? "?"}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                !p.matched
                  ? "bg-slate-100 text-slate-600"
                  : p.paid_out_at
                    ? "bg-paid-light text-paid"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {paymentStatus(p)}
            </span>
          </span>
          <span className="font-medium tabular-nums">{formatEuro(Number(p.amount))}</span>
        </li>
      ))}
    </ul>
  );
}

function PayoutsTab({ groupId, onUpdated }: { groupId: string; onUpdated: () => void }) {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [config, setConfig] = useState({
    payout_enabled: false,
    payout_iban: "",
    payout_recipient_name: "",
  });
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const [s, b, g] = await Promise.all([
      api.get<PayoutSummary>(`/groups/${groupId}/payout-summary`),
      api.get<PayoutBatch[]>(`/groups/${groupId}/payouts`),
      api.get<{ payout_enabled?: boolean; payout_iban?: string; payout_recipient_name?: string }>(
        `/groups/${groupId}`
      ),
    ]);
    setSummary(s);
    setBatches(b);
    setConfig({
      payout_enabled: !!g.payout_enabled,
      payout_iban: g.payout_iban ?? "",
      payout_recipient_name: g.payout_recipient_name ?? "",
    });
  }, [groupId]);

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, [load]);

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.patch(`/groups/${groupId}/payout-config`, config);
    toast.success(t("save"));
    load();
    onUpdated();
  };

  const runPayout = async (dryRun: boolean, force = false) => {
    setRunning(true);
    try {
      const q = dryRun ? "?dry_run=true" : force ? "?force=true" : "?force=true";
      const result = await api.post<PayoutRunResult>(`/groups/${groupId}/payout/run${q}`, {});
      if (result.status === "completed") {
        toast.success(`${formatEuro(result.total_amount ?? 0)} → ${t("sentToCommittee")}`);
      } else if (result.status === "dry_run") {
        toast.message(`${t("runPayoutDryRun")}: ${formatEuro(result.total_amount ?? 0)}`);
      } else {
        toast.message(result.reason ?? result.status);
      }
      load();
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-4 space-y-6">
      {summary && (
        <div className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">{t("payoutPending")}</p>
            <p className="text-xl font-bold tabular-nums">{formatEuro(Number(summary.pending_amount))}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("payoutMinimum")}</p>
            <p className="text-xl font-bold tabular-nums">{formatEuro(Number(summary.minimum_payout))}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("nextPayout")}</p>
            <p className="text-xl font-bold">{summary.next_payout_label}</p>
          </div>
        </div>
      )}

      <form onSubmit={saveConfig} className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 font-semibold">{t("payoutConfig")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder={t("committeeIban")}
            className="rounded-lg border px-3 py-2 text-sm"
            value={config.payout_iban}
            onChange={(e) => setConfig({ ...config, payout_iban: e.target.value })}
          />
          <input
            placeholder={t("committeeName")}
            className="rounded-lg border px-3 py-2 text-sm"
            value={config.payout_recipient_name}
            onChange={(e) => setConfig({ ...config, payout_recipient_name: e.target.value })}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.payout_enabled}
            onChange={(e) => setConfig({ ...config, payout_enabled: e.target.checked })}
          />
          {t("enablePayout")}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            {t("save")}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => runPayout(true)}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
          >
            {t("runPayoutDryRun")}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => runPayout(false, true)}
            className="rounded-lg border border-paid px-4 py-2 text-sm text-paid hover:bg-paid-light"
          >
            {t("runPayoutForce")}
          </button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 font-semibold">{t("payoutHistory")}</h3>
        <ul className="space-y-2">
          {batches.map((b) => (
            <li key={b.id} className="flex justify-between rounded-lg border bg-white px-4 py-3 text-sm">
              <span>
                {b.scheduled_for} — {b.status} ({b.payment_count} payments)
              </span>
              <span className="font-medium tabular-nums">{formatEuro(Number(b.total_amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
