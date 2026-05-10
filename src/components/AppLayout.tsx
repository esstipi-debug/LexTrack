import { Link, useLocation } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard, Gavel, Bell, FolderOpen, ClipboardList,
  FileText, ClipboardCheck, Bot, FileEdit, Scale, Shield,
  DollarSign, Newspaper, ChevronLeft, ChevronRight, Menu, X,
} from "lucide-react";

const menuItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/causas", label: "Causas", icon: Gavel },
  { path: "/alertas", label: "Alertas", icon: Bell },
  { path: "/tareas", label: "Tareas", icon: ClipboardList },
  { path: "/checklists", label: "Checklists", icon: ClipboardCheck },
  { path: "/asistente", label: "Asistente Legal", icon: Bot },
  { path: "/generador", label: "Generador", icon: FileEdit },
  { path: "/jurisprudencia", label: "Jurisprudencia", icon: Scale },
  { path: "/ley-karin", label: "Ley Karin", icon: Shield },
  { path: "/honorarios", label: "Honorarios", icon: DollarSign },
  { path: "/diario-oficial", label: "Diario Oficial", icon: Newspaper },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-50 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400">
              LexTrack
            </Link>
          )}
          {collapsed && <Gavel className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 64px)" }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-600 dark:text-gray-300"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Link
              to="/asistente"
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium dark:bg-blue-900/20 dark:text-blue-400"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Asistente AI</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
