import { Link, useLocation } from "react-router";
import { Home, Briefcase, Sparkles, Bell, MoreHorizontal } from "lucide-react";

type Item = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

const items: Item[] = [
  { to: "/app", label: "Inicio", icon: Home, exact: true },
  { to: "/app/causas", label: "Causas", icon: Briefcase },
  { to: "/app/asistente", label: "Asistente", icon: Sparkles },
  { to: "/app/alertas", label: "Alertas", icon: Bell },
  { to: "/app/settings", label: "Más", icon: MoreHorizontal },
];

function isActive(pathname: string, item: Item): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

export default function BottomNav() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal móvil"
    >
      <ul className="flex items-stretch justify-around h-16">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 h-full text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[#1e3a5f] dark:text-blue-300"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
