import { Routes, Route, useLocation, Navigate } from "react-router";
import { useEffect } from "react";
import AppLayout from "./components/AppLayout";
import AuthLayout from "./components/AuthLayout";
import { initAnalytics, trackPageview } from "./lib/analytics";
import { useAuth } from "./hooks/useAuth";

initAnalytics();
import Home from "./pages/Home";
import Causas from "./pages/Causas";
import Alertas from "./pages/Alertas";
import Tareas from "./pages/Tareas";
import Checklists from "./pages/Checklists";
import Asistente from "./pages/Asistente";
import Generador from "./pages/Generador";
import Jurisprudencia from "./pages/Jurisprudencia";
import LeyKarin from "./pages/LeyKarin";
import LeyKarinProtocolo from "./pages/LeyKarinProtocolo";
import Honorarios from "./pages/Honorarios";
import DiarioOficial from "./pages/DiarioOficial";
import ConsultaLegal from "./pages/ConsultaLegal";
import CausaDetalle from "./pages/CausaDetalle";
import PoderJudicial from "./pages/PoderJudicial";
import Billing from "./pages/Billing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";

/** Redirects users who haven't completed onboarding to /onboarding. */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  if (user && user.hasCompletedOnboarding === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public static pages — no auth required */}
      <Route path="/terminos" element={<Terminos />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route
        path="/*"
        element={
          <AuthLayout>
            <Routes>
              {/* Onboarding — inside AuthLayout but outside AppLayout and OnboardingGuard */}
              <Route path="/onboarding" element={<Onboarding />} />
              {/* All other authenticated routes */}
              <Route
                path="*"
                element={
                  <OnboardingGuard>
                    <AppLayout>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/causas" element={<Causas />} />
                        <Route path="/alertas" element={<Alertas />} />
                        <Route path="/tareas" element={<Tareas />} />
                        <Route path="/checklists" element={<Checklists />} />
                        <Route path="/asistente" element={<Asistente />} />
                        <Route path="/generador" element={<Generador />} />
                        <Route path="/jurisprudencia" element={<Jurisprudencia />} />
                        <Route path="/ley-karin" element={<LeyKarin />} />
                        <Route path="/ley-karin/protocolo" element={<LeyKarinProtocolo />} />
                        <Route path="/honorarios" element={<Honorarios />} />
                        <Route path="/diario-oficial" element={<DiarioOficial />} />
                        <Route path="/consulta-legal" element={<ConsultaLegal />} />
                        <Route path="/causas/:id" element={<CausaDetalle />} />
                        <Route path="/poder-judicial" element={<PoderJudicial />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppLayout>
                  </OnboardingGuard>
                }
              />
            </Routes>
          </AuthLayout>
        }
      />
    </Routes>
  );
}
