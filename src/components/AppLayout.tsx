import { Link, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Calculator,
  FilePen,
  BellRing,
  Gavel,
  ClipboardList,
  AlertCircle,
  DollarSign,
  Scale,
  Shield,
  Building2,
  Menu,
  X,
  Bot,
  Sun,
  Moon,
} from "lucide-react";
import { useLexTheme } from "@/hooks/use-lex-theme";

const mainNav = [
  { path: "/", label: "Inicio", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { path: "/asistente", label: "Preguntar", icon: MessageSquare, match: (p: string) => p === "/asistente" },
  {
    path: "/generador?tab=calculadora",
    label: "Calcular",
    icon: Calculator,
    match: (p: string) => p.startsWith("/generador"),
  },
  {
    path: "/generador?tab=documentos",
    label: "Escribir",
    icon: FilePen,
    match: (p: string) => p.startsWith("/generador"),
  },
  { path: "/diario-oficial", label: "Avisar", icon: BellRing, match: (p: string) => p === "/diario-oficial" },
];

const studioNav = [
  { path: "/causas", label: "Causas", icon: Gavel },
  { path: "/tareas", label: "Tareas", icon: ClipboardList },
  { path: "/alertas", label: "Alertas", icon: AlertCircle },
  { path: "/honorarios", label: "Honorarios", icon: DollarSign },
  { path: "/jurisprudencia", label: "Jurisprudencia", icon: Scale },
  { path: "/poder-judicial", label: "Poder Judicial", icon: Building2 },
];

function NavLink({
  to,
  label,
  icon: Icon,
  active,
  featured,
  badge,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  featured?: boolean;
  badge?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
        active
          ? "bg-blue-600 text-white"
          : featured
            ? "bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/40 dark:to-violet-900/30 border border-violet-500 text-gray-800 dark:text-violet-100 hover:from-violet-100 hover:to-violet-100"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-500 text-white rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useLexTheme();
  const pathname = location.pathname;

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-neutral-950 font-sans">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={closeMobile} aria-hidden />
      )}

      <aside
        className={`fixed lg:static z-50 h-full w-64 bg-white dark:bg-neutral-900 border-r border-gray-200 dark:border-neutral-800 flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-200 dark:border-neutral-800">
          <Link to="/" className="flex items-center gap-3" onClick={closeMobile}>
            <Gavel className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              LexTrack
            </span>
          </Link>
          <button type="button" onClick={closeMobile} className="lg:hidden text-gray-500 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-0.5">
            {mainNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                active={item.match(pathname)}
                onNavigate={closeMobile}
              />
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-neutral-800">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Estudio
            </p>
            {studioNav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                label={item.label}
                icon={item.icon}
                active={pathname === item.path}
                onNavigate={closeMobile}
              />
            ))}
          </div>

          <div className="mt-6 pt-4">
            <NavLink
              to="/ley-karin"
              label="Ley Karin"
              icon={Shield}
              active={pathname.startsWith("/ley-karin")}
              featured
              badge="Nuevo"
              onNavigate={closeMobile}
            />
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 shrink-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <Link
              to="/asistente"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
            >
              <Bot className="w-4 h-4" />
              Asistente
            </Link>
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center text-white text-sm font-bold"
              title="Usuario"
            >
              AB
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1200px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
