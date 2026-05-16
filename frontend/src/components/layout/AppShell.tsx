import { Link, Outlet, useNavigate } from "react-router-dom";
import { Building2, LogOut, Globe } from "lucide-react";
import { clearSession } from "@/lib/supabase";
import { getLocale, setLocale, t, type Locale } from "@/lib/i18n";

export function AppShell() {
  const navigate = useNavigate();
  const locale = getLocale();

  const toggleLocale = () => {
    const next: Locale = locale === "el" ? "en" : "el";
    setLocale(next);
    window.location.reload();
  };

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <Building2 className="h-6 w-6 text-slate-700" />
            {t("appTitle")}
          </Link>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              title="Language"
            >
              <Globe className="h-4 w-4" />
              {locale.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
