import { trpc } from "@/providers/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Gavel, ClipboardList, Bell, DollarSign, BookOpen, Scale } from "lucide-react";
import { Link } from "react-router";

export default function Home() {
  const { data: stats } = trpc.rag.estadisticas.useQuery();
  const { data: causasList } = trpc.causa.listar.useQuery();
  const { data: tareasList } = trpc.tarea.listar.useQuery();
  const { data: alertasList } = trpc.alerta.listar.useQuery();
  const { data: honorariosStats } = trpc.honorario.estadisticas.useQuery();

  const statsCards = [
    { label: "Causas activas", value: causasList?.length || 0, icon: Gavel, color: "text-blue-600", bg: "bg-blue-50", link: "/causas" },
    { label: "Tareas pendientes", value: tareasList?.filter(t => t.estado === "pendiente").length || 0, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50", link: "/tareas" },
    { label: "Alertas sin leer", value: alertasList?.filter(a => a.estado === "pendiente").length || 0, icon: Bell, color: "text-red-600", bg: "bg-red-50", link: "/alertas" },
    { label: "Por cobrar", value: honorariosStats ? `$${honorariosStats.porCobrar.toLocaleString("es-CL")}` : "$0", icon: DollarSign, color: "text-green-600", bg: "bg-green-50", link: "/honorarios" },
    { label: "Docs en RAG", value: stats?.totalDocumentos || 0, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50", link: "/asistente" },
    { label: "Fallos cargados", value: stats?.totalJurisprudencia || 0, icon: Scale, color: "text-indigo-600", bg: "bg-indigo-50", link: "/jurisprudencia" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Resumen de tu estudio jurídico laboral</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${card.bg}`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{card.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Últimas causas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(causasList || []).slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{c.caratula}</p>
                    <p className="text-xs text-gray-500">RIT: {c.rit} | {c.tribunal}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    c.estado === "tramitacion" ? "bg-blue-100 text-blue-700" :
                    c.estado === "sentencia" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{c.estado}</span>
                </div>
              ))}
              {(!causasList || causasList.length === 0) && (
                <p className="text-gray-400 text-sm">No hay causas registradas</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tareas próximas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(tareasList || []).slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{t.titulo}</p>
                    <p className="text-xs text-gray-500">Vence: {t.fechaVencimiento || "Sin fecha"}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    t.prioridad === "alta" || t.prioridad === "critica" ? "bg-red-100 text-red-700" :
                    t.prioridad === "media" ? "bg-amber-100 text-amber-700" :
                    "bg-green-100 text-green-700"
                  }`}>{t.prioridad}</span>
                </div>
              ))}
              {(!tareasList || tareasList.length === 0) && (
                <p className="text-gray-400 text-sm">No hay tareas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Base de conocimiento RAG</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats?.porNorma && Object.entries(stats.porNorma).map(([norma, count]) => (
              <div key={norma} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{count as number}</p>
                <p className="text-xs text-gray-500">{norma}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
