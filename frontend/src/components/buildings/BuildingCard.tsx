import { Link } from "react-router-dom";
import { AlertCircle, Building2 } from "lucide-react";
import { t } from "@/lib/i18n";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function BuildingCard({
  building,
  stats,
}: {
  building: { id: string; name: string; address?: string };
  stats?: { outstanding: number; overdueCount: number; collected: number; total: number };
}) {
  const progress =
    stats && stats.total > 0
      ? Math.round((stats.collected / (stats.collected + stats.outstanding || 1)) * 100)
      : 0;

  return (
    <Link
      to={`/buildings/${building.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{building.name}</h3>
            {building.address && (
              <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{building.address}</p>
            )}
          </div>
        </div>
        {stats && stats.overdueCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-overdue-light px-2 py-1 text-xs font-medium text-overdue">
            <AlertCircle className="h-3.5 w-3.5" />
            {stats.overdueCount} {t("overdue").toLowerCase()}
          </span>
        )}
      </div>
      {stats && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-slate-600">
            <span>{t("collected")}</span>
            <span className="tabular-nums font-medium">{formatEuro(stats.collected)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-paid transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {t("outstanding")}:{" "}
            <span className="font-medium text-slate-800">{formatEuro(stats.outstanding)}</span>
          </p>
        </div>
      )}
    </Link>
  );
}

