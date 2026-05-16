import clsx from "clsx";
import { t } from "@/lib/i18n";

const labels: Record<string, string> = {
  paid: "statusPaid",
  pending: "statusPending",
  overdue: "statusOverdue",
  escalated: "statusOverdue",
  legal: "statusOverdue",
};

export function StatusBadge({ status }: { status: string }) {
  const key = labels[status] ?? "statusPending";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "paid" && "bg-paid-light text-paid",
        status === "pending" && "bg-pending-light text-pending",
        (status === "overdue" || status === "escalated" || status === "legal") &&
          "bg-overdue-light text-overdue"
      )}
    >
      {t(key as "statusPaid")}
    </span>
  );
}
