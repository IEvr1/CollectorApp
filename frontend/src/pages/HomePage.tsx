import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, type Group, type GroupCreatePayload, type GroupDashboard } from "@/lib/api";
import { GroupCard } from "@/components/groups/GroupCard";
import { groupTypeLabel, splitMethodLabel, t } from "@/lib/i18n";
import type { GroupType, SplitMethod } from "@/lib/i18n";

export function HomePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<Record<string, GroupDashboard>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<GroupCreatePayload>({
    name: "",
    address: "",
    virtual_iban: "",
    group_type: "building",
    split_method: "by_area",
    payout_enabled: false,
    payout_iban: "",
    payout_recipient_name: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<Group[]>("/groups");
        setGroups(list);
        const dash: Record<string, GroupDashboard> = {};
        await Promise.all(
          list.map(async (g) => {
            try {
              dash[g.id] = await api.get<GroupDashboard>(`/groups/${g.id}/dashboard`);
            } catch {
              /* skip */
            }
          })
        );
        setStats(dash);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...groups].sort((a, b) => {
    const sa = stats[a.id];
    const sb = stats[b.id];
    const scoreA = Number(sa?.pending_payout ?? 0) + Number(sa?.outstanding ?? 0);
    const scoreB = Number(sb?.pending_payout ?? 0) + Number(sb?.outstanding ?? 0);
    return scoreB - scoreA;
  });

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = await api.post<Group>("/groups", {
      ...form,
      address: form.address || null,
      virtual_iban: form.virtual_iban || null,
      payout_iban: form.payout_iban || null,
      payout_recipient_name: form.payout_recipient_name || null,
    });
    setGroups((prev) => [...prev, g]);
    setShowNew(false);
    setForm({
      name: "",
      address: "",
      virtual_iban: "",
      group_type: "building",
      split_method: "by_area",
      payout_enabled: false,
      payout_iban: "",
      payout_recipient_name: "",
    });
  };

  if (loading) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("needsAttention")}</h1>
          <p className="text-slate-500">{t("groups")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          {t("addGroup")}
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={createGroup}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              required
              placeholder={t("groupName")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder={t("address")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <input
              placeholder={t("collectionIban")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.virtual_iban}
              onChange={(e) => setForm({ ...form, virtual_iban: e.target.value })}
            />
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.group_type}
              onChange={(e) => setForm({ ...form, group_type: e.target.value as GroupType })}
            >
              {(["building", "school", "association", "other"] as GroupType[]).map((gt) => (
                <option key={gt} value={gt}>
                  {groupTypeLabel(gt)}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.split_method}
              onChange={(e) => setForm({ ...form, split_method: e.target.value as SplitMethod })}
            >
              {(["by_area", "equal", "custom_weight"] as SplitMethod[]).map((sm) => (
                <option key={sm} value={sm}>
                  {splitMethodLabel(sm)}
                </option>
              ))}
            </select>
            <input
              placeholder={t("committeeIban")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.payout_iban}
              onChange={(e) => setForm({ ...form, payout_iban: e.target.value })}
            />
            <input
              placeholder={t("committeeName")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.payout_recipient_name}
              onChange={(e) => setForm({ ...form, payout_recipient_name: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={!!form.payout_enabled}
                onChange={(e) => setForm({ ...form, payout_enabled: e.target.checked })}
              />
              {t("enablePayout")}
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-lg bg-paid px-4 py-2 text-sm text-white">
              {t("confirm")}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-600">{t("noGroups")}</p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="mt-4 text-sm font-medium text-slate-900 underline"
          >
            {t("createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((g) => {
            const d = stats[g.id];
            const overdueCount = d?.units.filter((u) => u.status === "overdue").length ?? 0;
            return (
              <GroupCard
                key={g.id}
                group={g}
                stats={
                  d
                    ? {
                        outstanding: Number(d.outstanding),
                        overdueCount,
                        collected: Number(d.collected_this_month),
                        held: Number(d.pending_payout),
                        lastPayout: d.last_payout_amount != null ? Number(d.last_payout_amount) : undefined,
                        total: d.units_total,
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
