import { Routes, Route } from "react-router";
import AppLayout from "./components/AppLayout";
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
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
}
