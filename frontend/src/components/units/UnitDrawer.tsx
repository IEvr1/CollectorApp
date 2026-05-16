import { useState } from "react";
import { X, Copy, MessageSquare, QrCode } from "lucide-react";
import { toast } from "sonner";
import type { UnitWithLedger } from "@/lib/api";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { t } from "@/lib/i18n";

function formatEuro(n: number) {
  return new Intl.NumberFormat("el-CY", { style: "currency", currency: "EUR" }).format(n);
}

export function UnitDrawer({
  unit,
  onClose,
}: {
  unit: UnitWithLedger;
  buildingId?: string;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const ref = unit.ledger?.payment_reference ?? "";

  const copyRef = () => {
    if (ref) {
      navigator.clipboard.writeText(ref);
      toast.success("Αναφορά αντιγράφηκε");
    }
  };

  const sendReminder = async () => {
    try {
      await api.post("/notifications/send", {
        unit_id: unit.id,
        template_key: "charge_notice",
        channels: ["sms", "email"],
      });
      toast.success("Υπενθύμιση στάλθηκε");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  const loadQr = async () => {
    try {
      const data = await api.get<{ qr_png_base64: string }>(`/units/${unit.id}/payment-qr`);
      setQrUrl(`data:image/png;base64,${data.qr_png_base64}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">#{unit.unit_number}</h2>
            {unit.owner_name && <p className="text-sm text-slate-500">{unit.owner_name}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-4">
          <div>
            <StatusBadge status={unit.status} />
            <p className="mt-3 text-3xl font-bold tabular-nums">{formatEuro(unit.balance)}</p>
            <p className="text-sm text-slate-500">Υπόλοιπο τρέχοντος μήνα</p>
          </div>

          {ref && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Αναφορά πληρωμής</p>
              <p className="mt-1 break-all font-mono text-xs">{ref}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={copyRef}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm hover:bg-slate-50"
            >
              <Copy className="h-4 w-4" />
              {t("copyReference")}
            </button>
            <button
              type="button"
              onClick={sendReminder}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm hover:bg-slate-50"
            >
              <MessageSquare className="h-4 w-4" />
              {t("sendReminder")}
            </button>
            <button
              type="button"
              onClick={loadQr}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm text-white hover:bg-slate-800"
            >
              <QrCode className="h-4 w-4" />
              {t("paymentQr")}
            </button>
          </div>

          {qrUrl && (
            <img src={qrUrl} alt="Payment QR" className="mx-auto w-48 rounded-lg border" />
          )}
        </div>
      </div>
    </div>
  );
}
