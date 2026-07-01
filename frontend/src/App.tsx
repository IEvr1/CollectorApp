import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { getAccessToken } from "@/lib/auth";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { GroupPage } from "@/pages/GroupPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function BuildingRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/groups/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="/buildings/:id" element={<BuildingRedirect />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
