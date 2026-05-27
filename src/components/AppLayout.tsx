import { Link, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  Menu,
  X,
  Bot,
  Sun,
  Moon,
  BookOpen,
  CheckSquare,
  Building2,
  Bell,
} from "lucide-react";
import { useLexTheme } from "@/hooks/use-lex-theme";
import { trpc } from "@/providers/trpc";
import BottomNav from "@/components/BottomNav";
import TrialBanner from "@/components/TrialBanner";

const mainNav = [
  { path: "/app", label: "Inicio", icon: LayoutDashboard, match: (p: string) => p === "/app" },
  { path: "/app/asistente", label: "Preguntar", icon: MessageSquare, match: (p: string) => p === "/app/asistente" },
  { path: "/app/consulta-legal", label: "Consulta Legal", icon: BookOpen, match: (p: string) => p === "/app/consulta-legal" },
  {
    path: "/app/generador?tab=calculadora",
    label: "Calcular",
    icon: Calculator,
    match: (p: string) => p.startsWith("/app/generador"),
  },
  {
    path: "/app/generador?tab=documentos",
    label: "Escribir",
    icon: FilePen,
    match: (p: string) => p.startsWith("/app/generador"),
  },
  { path: "/app/diario-oficial", label: "Avisar", icon: BellRing, match: (p: string) => p === "/app/diario-oficial" },
];

const studioNav = [
  { path: "/app/causas", label: "Causas", icon: Gavel },
  { path: "/app/tareas", label: "Tareas", icon: ClipboardList },
  { path: "/app/checklists", label: "Checklists", icon: CheckSquare },
  { path: "/app/alertas", label: "Alertas", icon: AlertCircle },
  { path: "/app/honorarios", label: "Honorarios", icon: DollarSign },
  { path: "/app/jurisprudencia", label: "Jurisprudencia", icon: Scale },
  { path: "/app/poder-judicial", label: "Poder Judicial", icon: Building2 },
  { path: "/app/calculadoras", label: "Calculadoras", icon: Calculator },
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

function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function NotificationBell() {
  const navigate = useNavigate();
  const { data } = trpc.alerta.listar.useQuery(
    { limit: 5 },
    { refetchInterval: 60_000 }
  );
  const unreadCount = data?.items?.filter((a) => a.estado === "pendiente").length ?? 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/app/alertas")}
      className="relative p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
      title="Alertas"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useLexTheme();
  const { user } = useAuth();
  const pathname = location.pathname;

  const { data: orgData } = trpc.org.miOrg.useQuery();

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
          <Link to="/app" className="flex items-center gap-3" onClick={closeMobile}>
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
              to="/app/ley-karin"
              label="Ley Karin"
              icon={Shield}
              active={pathname.startsWith("/app/ley-karin")}
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
            <NotificationBell />
            <Link
              to="/app/asistente"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-600 dark:hover:text-white"
            >
              <Bot className="w-4 h-4" />
              Asistente
            </Link>
            <div className="flex flex-col items-end gap-0.5">
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center text-white text-sm font-bold"
                title={user?.name ?? "Usuario"}
              >
                {getUserInitials(user?.name)}
              </div>
              {orgData && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 max-w-[140px]">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{orgData.nombre}</span>
                </span>
              )}
            </div>
          </div>
        </header>

        <TrialBanner />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <div className="max-w-[1200px] mx-auto">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
