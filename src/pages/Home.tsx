import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Calculator,
  FilePen,
  BellRing,
  Shield,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router";

const actions = [
  {
    title: "Preguntar",
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
    title: "Avisar",
    desc: "Cambios Diario Oficial laboral",
    to: "/diario-oficial",
    icon: BellRing,
    color: "text-red-400",
  },
];

function estadoBadge(estado: string) {
  if (estado === "tramitacion") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (estado === "sentencia") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function prioridadBadge(p: string) {
  if (p === "alta" || p === "critica") return "bg-red-100 text-red-700";
  if (p === "media") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

export default function Home() {
  const { data: stats } = trpc.rag.estadisticas.useQuery();
  const { data: causasList } = trpc.causa.listar.useQuery();
  const { data: tareasList } = trpc.tarea.listar.useQuery();
  const { data: alertasList } = trpc.alerta.listar.useQuery();
  const { data: honorariosStats } = trpc.honorario.estadisticas.useQuery();

  const metrics = [
    { label: "Causas activas", value: causasList?.length ?? 0, to: "/causas" },
    {
      label: "Tareas pendientes",
      value: tareasList?.filter((t) => t.estado === "pendiente").length ?? 0,
      to: "/tareas",
    },
    {
      label: "Alertas sin leer",
      value: alertasList?.filter((a) => a.estado === "pendiente").length ?? 0,
      to: "/alertas",
    },
    {
      label: "Por cobrar",
      value: honorariosStats ? `$${honorariosStats.porCobrar.toLocaleString("es-CL")}` : "$0",
      to: "/honorarios",
    },
    { label: "Artículos en base", value: stats?.totalDocumentos ?? 0, to: "/asistente" },
    { label: "Fallos cargados", value: stats?.totalJurisprudencia ?? 0, to: "/jurisprudencia" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <section>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Buenos días
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Cuatro herramientas. Sin chat genérico.</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-7 flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <Icon className={`w-12 h-12 mb-5 ${a.color}`} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{a.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex-1">{a.desc}</p>
              <ArrowRight className="w-5 h-5 text-gray-400 self-end mt-4 group-hover:translate-x-1 group-hover:text-gray-600 transition-transform" />
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border-2 border-violet-500 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-neutral-900 p-7 flex flex-col md:flex-row items-start md:items-center gap-6">
        <Shield className="w-14 h-14 text-violet-600 shrink-0" />
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Ley Karin — Protocolo y cumplimiento
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Genera protocolo, reglamento y checklist Ley 21.643
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link to="/ley-karin/protocolo">Abrir wizard</Link>
            </Button>
            <Button asChild variant="ghost" className="text-violet-700 dark:text-violet-300">
              <Link to="/ley-karin">Ver denuncias</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <Link
            key={m.label}
            to={m.to}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-4 text-center hover:shadow-md transition-shadow"
          >
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
              {m.value}
            </p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{m.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg">Últimas causas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(causasList || []).slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-neutral-800 last:border-0"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.caratula}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    RIT: {c.rit} · {c.tribunal}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase rounded-full ${estadoBadge(c.estado)}`}>
                  {c.estado}
                </span>
              </div>
            ))}
            {(!causasList || causasList.length === 0) && (
              <p className="text-sm text-gray-400 py-4">No hay causas registradas</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-neutral-800">
          <CardHeader>
            <CardTitle className="text-lg">Tareas próximas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(tareasList || []).slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-3.5 border-b border-gray-100 dark:border-neutral-800 last:border-0"
              >
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{t.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Vence:{" "}
                    {t.fechaVencimiento
                      ? new Date(t.fechaVencimiento).toLocaleDateString("es-CL")
                      : "Sin fecha"}
                  </p>
                </div>
                <span className={`px-2.5 py-1 text-[11px] font-semibold uppercase rounded-full ${prioridadBadge(t.prioridad)}`}>
                  {t.prioridad}
                </span>
              </div>
            ))}
            {(!tareasList || tareasList.length === 0) && (
              <p className="text-sm text-gray-400 py-4">No hay tareas pendientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-4">
        LexTrack no reemplaza tu criterio profesional. Cada respuesta incluye fuentes citadas.
      </p>
    </div>
  );
}
