import { Link } from "react-router-dom";
import { AlertCircle, Users } from "lucide-react";
import { t } from "@/lib/i18n";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function GroupCard({
  group,
  stats,
}: {
  group: { id: string; name: string; address?: string };
  stats?: {
    outstanding: number;
    overdueCount: number;
    collected: number;
    held: number;
    lastPayout?: number;
    total: number;
  };
}) {
  const progress =
    stats && stats.total > 0
      ? Math.round((stats.collected / (stats.collected + stats.outstanding || 1)) * 100)
      : 0;

  return (
    <Link
      to={`/groups/${group.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{group.name}</h3>
            {group.address && (
              <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{group.address}</p>
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
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>{t("outstanding")}</span>
            <span className="tabular-nums font-medium text-overdue">{formatEuro(stats.outstanding)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>{t("heldForPayout")}</span>
            <span className="tabular-nums font-medium text-slate-900">{formatEuro(stats.held)}</span>
          </div>
          {stats.lastPayout != null && stats.lastPayout > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>{t("sentToCommittee")}</span>
              <span className="tabular-nums font-medium">{formatEuro(stats.lastPayout)}</span>
            </div>
          )}
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-paid transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {t("collected")}: {formatEuro(stats.collected)}
          </p>
        </div>
      )}
    </Link>
  );
}
