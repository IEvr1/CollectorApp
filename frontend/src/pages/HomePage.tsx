import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api, type Building, type BuildingDashboard } from "@/lib/api";
import { BuildingCard } from "@/components/buildings/BuildingCard";
import { t } from "@/lib/i18n";

export function HomePage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stats, setStats] = useState<Record<string, BuildingDashboard>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", virtual_iban: "" });

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<Building[]>("/buildings");
        setBuildings(list);
        const dash: Record<string, BuildingDashboard> = {};
        await Promise.all(
          list.map(async (b) => {
            try {
              dash[b.id] = await api.get<BuildingDashboard>(`/buildings/${b.id}/dashboard`);
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

  const sorted = [...buildings].sort((a, b) => {
    const oa = stats[a.id]?.outstanding ?? 0;
    const ob = stats[b.id]?.outstanding ?? 0;
    return ob - oa;
  });

  const createBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = await api.post<Building>("/buildings", form);
    setBuildings((prev) => [...prev, b]);
    setShowNew(false);
    setForm({ name: "", address: "", virtual_iban: "" });
  };

  if (loading) {
    return <p className="text-slate-500">{t("loading")}</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("needsAttention")}</h1>
          <p className="text-slate-500">{t("buildings")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          {t("addBuilding")}
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={createBuilding}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder={t("buildingName")}
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
              placeholder={t("virtualIban")}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.virtual_iban}
              onChange={(e) => setForm({ ...form, virtual_iban: e.target.value })}
            />
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
          <p className="text-slate-600">{t("noBuildings")}</p>
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
          {sorted.map((b) => {
            const d = stats[b.id];
            const overdueCount = d?.units.filter((u) => u.status === "overdue").length ?? 0;
            return (
              <BuildingCard
                key={b.id}
                building={b}
                stats={
                  d
                    ? {
                        outstanding: Number(d.outstanding),
                        overdueCount,
                        collected: Number(d.collected_this_month),
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
