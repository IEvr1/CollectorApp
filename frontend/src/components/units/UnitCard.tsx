import clsx from "clsx";
import type { UnitWithLedger } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function UnitCard({
  unit,
  onClick,
  highlighted,
}: {
  unit: UnitWithLedger;
  onClick: () => void;
  highlighted?: boolean;
}) {
  const border =
    unit.status === "paid"
      ? "border-l-paid"
      : unit.status === "overdue" || unit.status === "escalated"
        ? "border-l-overdue"
        : "border-l-pending";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full rounded-lg border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition hover:shadow-md",
        border,
        highlighted && "ring-2 ring-paid ring-offset-1"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-slate-900">#{unit.unit_number}</p>
          {unit.owner_name && <p className="text-sm text-slate-500">{unit.owner_name}</p>}
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums text-slate-900">{formatEuro(unit.balance)}</p>
    </button>
  );
}
