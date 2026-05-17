import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";

export function PaymentSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <CheckCircle2 className="h-16 w-16 text-emerald-600" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">{t("paymentSuccessTitle")}</h1>
      <p className="mt-2 max-w-md text-center text-slate-600">{t("paymentSuccessBody")}</p>
      <Link
        to="/login"
        className="mt-8 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        {t("login")}
      </Link>
    </div>
  );
}
