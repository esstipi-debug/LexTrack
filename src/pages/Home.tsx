import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Calculator,
  FilePen,
  BellRing,
  Shield,
  ArrowRight,
  Briefcase,
  ClipboardList,
  Bell,
  DollarSign,
  AlertTriangle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
} from "lucide-react";
import { Link } from "react-router";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clpFormat(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

function dateFormat(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-CL");
}

function nowGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function TrendBadge({
  current,
  previous,
  label,
}: {
  current: number;
  previous: number;
  label: string;
}) {
  if (current === previous || previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Minus className="w-3 h-3" />
        {label}
      </span>
    );
  }
  const up = current > previous;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${up ? "text-green-600" : "text-red-500"}`}
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ─── Quick-action cards ───────────────────────────────────────────────────────

const actions = [
  {
    title: "Asistente",
    desc: "Normativa y jurisprudencia con citas",
    to: "/asistente",
    icon: MessageSquare,
    color: "text-blue-600",
  },
  {
    title: "Calcular",
    desc: "Indemnización, finiquito, horas extra",
    to: "/generador?tab=calculadora",
    icon: Calculator,
    color: "text-green-600",
  },
  {
    title: "Escribir",
    desc: "Cartas, demandas, finiquitos guiados",
    to: "/generador?tab=documentos",
    icon: FilePen,
    color: "text-amber-600",
  },
  {
    title: "Nueva Tarea",
    desc: "Registrar y hacer seguimiento",
    to: "/tareas",
    icon: ClipboardList,
    color: "text-violet-600",
  },
];

// ─── Activity icon map ────────────────────────────────────────────────────────

function actividadIcon(tipo: string) {
  if (tipo.startsWith("causa")) return Briefcase;
  if (tipo.startsWith("tarea")) return ClipboardList;
  if (tipo.startsWith("alerta")) return Bell;
  return ArrowRight;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const { data: dashboard, isLoading } = trpc.stats.dashboard.useQuery();

  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Summary cards config
  const summaryCards = [
    {
      title: "Causas Activas",
      value: dashboard?.causas.activas ?? 0,
      sub: `de ${dashboard?.causas.total ?? 0} total`,
      icon: Briefcase,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      to: "/causas",
      extra: dashboard?.tendencias ? (
        <TrendBadge
          current={dashboard.tendencias.causasEsteMes}
          previous={dashboard.tendencias.causasMesAnterior}
          label="vs mes anterior"
        />
      ) : null,
    },
    {
      title: "Tareas Pendientes",
      value: dashboard?.tareas.pendientes ?? 0,
      sub:
        (dashboard?.tareas.vencidas ?? 0) > 0
          ? `${dashboard!.tareas.vencidas} vencida${dashboard!.tareas.vencidas !== 1 ? "s" : ""}`
          : "sin vencidos",
      icon: ClipboardList,
      iconColor: (dashboard?.tareas.vencidas ?? 0) > 0 ? "text-red-600" : "text-violet-600",
      bgColor:
        (dashboard?.tareas.vencidas ?? 0) > 0
          ? "bg-red-50 dark:bg-red-950/20"
          : "bg-violet-50 dark:bg-violet-950/20",
      to: "/tareas",
      extra:
        (dashboard?.tareas.vencidas ?? 0) > 0 ? (
          <Badge variant="destructive" className="text-[10px] py-0">
            {dashboard!.tareas.vencidas} vencida{dashboard!.tareas.vencidas !== 1 ? "s" : ""}
          </Badge>
        ) : null,
    },
    {
      title: "Alertas Pendientes",
      value: dashboard?.alertas.pendientes ?? 0,
      sub: dashboard?.alertas.porPrioridad
        ? Object.entries(dashboard.alertas.porPrioridad)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(" · ") || "sin alertas"
        : "—",
      icon: Bell,
      iconColor:
        (dashboard?.alertas.porPrioridad?.["critica"] ?? 0) > 0
          ? "text-red-600"
          : "text-amber-600",
      bgColor:
        (dashboard?.alertas.porPrioridad?.["critica"] ?? 0) > 0
          ? "bg-red-50 dark:bg-red-950/20"
          : "bg-amber-50 dark:bg-amber-950/20",
      to: "/alertas",
      extra:
        (dashboard?.alertas.porPrioridad?.["critica"] ?? 0) > 0 ? (
          <Badge variant="destructive" className="text-[10px] py-0">
            {dashboard!.alertas.porPrioridad!["critica"]} crítica
            {dashboard!.alertas.porPrioridad!["critica"] !== 1 ? "s" : ""}
          </Badge>
        ) : null,
    },
    {
      title: "Honorarios por Cobrar",
      value: clpFormat(dashboard?.honorarios.porCobrar ?? 0),
      sub: `facturado: ${clpFormat(dashboard?.honorarios.totalFacturado ?? 0)}`,
      icon: DollarSign,
      iconColor: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      to: "/honorarios",
      extra:
        (dashboard?.honorarios.morosidad ?? 0) > 0 ? (
          <span className="text-xs text-red-600 font-medium">
            {clpFormat(dashboard!.honorarios.morosidad)} moroso
          </span>
        ) : null,
    },
    {
      title: "Ley Karin Activas",
      value: dashboard?.leyKarin.activas ?? 0,
      sub: `de ${dashboard?.leyKarin.total ?? 0} total`,
      icon: Shield,
      iconColor:
        (dashboard?.leyKarin.urgentes ?? 0) > 0 ? "text-red-600" : "text-violet-600",
      bgColor:
        (dashboard?.leyKarin.urgentes ?? 0) > 0
          ? "bg-red-50 dark:bg-red-950/20"
          : "bg-violet-50 dark:bg-violet-950/20",
      to: "/ley-karin",
      extra:
        (dashboard?.leyKarin.urgentes ?? 0) > 0 ? (
          <Badge variant="destructive" className="text-[10px] py-0">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {dashboard!.leyKarin.urgentes} urgente
            {dashboard!.leyKarin.urgentes !== 1 ? "s" : ""}
          </Badge>
        ) : null,
    },
    {
      title: "Plazos Próximos",
      value: dashboard?.tareas.proximas7dias ?? 0,
      sub: "vencen en 7 días",
      icon: Calendar,
      iconColor:
        (dashboard?.tareas.proximas7dias ?? 0) > 0 ? "text-amber-600" : "text-gray-500",
      bgColor:
        (dashboard?.tareas.proximas7dias ?? 0) > 0
          ? "bg-amber-50 dark:bg-amber-950/20"
          : "bg-gray-50 dark:bg-neutral-900",
      to: "/tareas",
      extra: dashboard?.tendencias ? (
        <TrendBadge
          current={dashboard.tendencias.tareasCompletadasEsteMes}
          previous={dashboard.tendencias.tareasCompletadasMesAnterior}
          label="completadas vs anterior"
        />
      ) : null,
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {nowGreeting()}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Link to="/tareas">
              <Plus className="w-4 h-4 mr-1" />
              Nueva Tarea
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/asistente">
              <MessageSquare className="w-4 h-4 mr-1" />
              Asistente
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Summary cards 2×3 ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} to={card.to}>
              <Card className="hover:shadow-md transition-shadow border-gray-200 dark:border-neutral-800 h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`rounded-lg p-2.5 ${card.bgColor} shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                    {card.extra && <div>{card.extra}</div>}
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                      {isLoading ? (
                        <span className="inline-block w-16 h-7 bg-gray-200 dark:bg-neutral-700 rounded animate-pulse" />
                      ) : (
                        card.value
                      )}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                      {card.title}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {card.sub}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="group bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <Icon className={`w-10 h-10 mb-4 ${a.color}`} />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {a.title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex-1">
                  {a.desc}
                </p>
                <ArrowRight className="w-4 h-4 text-gray-400 self-end mt-3 group-hover:translate-x-1 group-hover:text-gray-600 transition-transform" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Ley Karin banner ────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-violet-500 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-neutral-900 p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
        <Shield className="w-12 h-12 text-violet-600 shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Ley Karin — Protocolo y cumplimiento
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            Genera protocolo, reglamento y checklist Ley 21.643
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button asChild className="bg-blue-600 hover:bg-blue-700" size="sm">
              <Link to="/ley-karin/protocolo">Abrir wizard</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-violet-700 dark:text-violet-300"
            >
              <Link to="/ley-karin">Ver denuncias</Link>
            </Button>
          </div>
        </div>
        {(dashboard?.leyKarin.urgentes ?? 0) > 0 && (
          <div className="flex items-center gap-2 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg px-4 py-2.5 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {dashboard!.leyKarin.urgentes} denuncia
            {dashboard!.leyKarin.urgentes !== 1 ? "s" : ""} urgente
            {dashboard!.leyKarin.urgentes !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Causa state + recent activity ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Estado de causas */}
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado de causas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dashboard?.causas.porEstado &&
            Object.values(dashboard.causas.porEstado).some((v) => v > 0) ? (
              <div className="space-y-2">
                {Object.entries(dashboard.causas.porEstado)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([estado, count]) => (
                    <div key={estado} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-0.5">
                          <span className="capitalize text-gray-700 dark:text-gray-300">
                            {estado.replace("_", " ")}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${Math.round(
                                (count / (dashboard.causas.total || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4">No hay causas registradas</p>
            )}
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {dashboard?.actividadReciente && dashboard.actividadReciente.length > 0 ? (
              <div>
                {dashboard.actividadReciente.map((a) => {
                  const Icon = actividadIcon(a.tipo);
                  return (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-neutral-800 last:border-0"
                    >
                      <div className="rounded-md bg-gray-100 dark:bg-neutral-800 p-1.5 mt-0.5 shrink-0">
                        <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {a.titulo}
                        </p>
                        {a.descripcion && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {a.descripcion}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {dateFormat(a.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-4">Sin actividad reciente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Honorarios breakdown ─────────────────────────────────────── */}
      {(dashboard?.honorarios.totalFacturado ?? 0) > 0 && (
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumen de honorarios</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Total facturado",
                  value: clpFormat(dashboard!.honorarios.totalFacturado),
                  color: "text-gray-900 dark:text-white",
                },
                {
                  label: "Total pagado",
                  value: clpFormat(dashboard!.honorarios.totalPagado),
                  color: "text-green-700 dark:text-green-400",
                },
                {
                  label: "Por cobrar",
                  value: clpFormat(dashboard!.honorarios.porCobrar),
                  color: "text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Morosidad",
                  value: clpFormat(dashboard!.honorarios.morosidad),
                  color:
                    dashboard!.honorarios.morosidad > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-gray-400",
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className={`text-lg font-extrabold tabular-nums ${item.color}`}>
                    {item.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4">
        LexTrack no reemplaza tu criterio profesional. Cada respuesta incluye fuentes citadas.
      </p>
    </div>
  );
}
