import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gavel,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bell,
  FileText,
  Calendar,
  Shield,
  TrendingUp,
  CircleDot,
  MessageSquare,
  ListChecks,
} from "lucide-react";

const estadoColor: Record<string, string> = {
  tramitacion: "bg-blue-100 text-blue-700",
  sentencia: "bg-green-100 text-green-700",
  ejecucion: "bg-amber-100 text-amber-700",
  concluida: "bg-gray-100 text-gray-700",
  archivada: "bg-gray-100 text-gray-500",
  notificacion: "bg-purple-100 text-purple-700",
  prueba: "bg-orange-100 text-orange-700",
};

const riesgoConfig: Record<string, { color: string; bg: string; label: string }> = {
  bajo: { color: "text-green-700", bg: "bg-green-100", label: "Bajo" },
  medio: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Medio" },
  alto: { color: "text-orange-700", bg: "bg-orange-100", label: "Alto" },
  critico: { color: "text-red-700", bg: "bg-red-100", label: "Critico" },
};

const tipoTimelineIcon: Record<string, typeof Gavel> = {
  ingreso: FileText,
  audiencia: Calendar,
  resolucion: Gavel,
  notificacion: Bell,
  tramite: ListChecks,
  prueba: Shield,
  sentencia: Gavel,
  apelacion: TrendingUp,
  cambio_estado: CircleDot,
  escrito_presentado: FileText,
  otro: CircleDot,
};

const prioridadColor: Record<string, string> = {
  baja: "bg-gray-100 text-gray-600",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  critica: "bg-red-100 text-red-700",
};

const tareaEstadoColor: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  en_progreso: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-gray-100 text-gray-500",
};

const notaTipoColor: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  estrategia: "bg-purple-100 text-purple-700",
  cliente: "bg-blue-100 text-blue-700",
  procesal: "bg-amber-100 text-amber-700",
  evidencia: "bg-green-100 text-green-700",
};

function formatDate(d: unknown): string {
  if (!d) return "-";
  const s = String(d);
  try {
    const date = new Date(s);
    if (isNaN(date.getTime())) return s;
    return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

export default function CausaDetalle() {
  const { id } = useParams<{ id: string }>();
  const causaId = Number(id);

  const { data: causa, isLoading: loadingCausa } = trpc.causa.obtener.useQuery(
    { id: causaId },
    { enabled: !isNaN(causaId) }
  );

  const { data: analisis } = trpc.causa.analisis.useQuery(
    { id: causaId },
    { enabled: !isNaN(causaId) }
  );

  const { data: timeline, isLoading: loadingTimeline } = trpc.causa.timeline.useQuery(
    { id: causaId },
    { enabled: !isNaN(causaId) }
  );

  if (loadingCausa) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!causa) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Causa no encontrada</p>
        <Link to="/causas">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Causas
          </Button>
        </Link>
      </div>
    );
  }

  const riesgo = analisis && "nivelRiesgo" in analisis ? riesgoConfig[analisis.nivelRiesgo as string] : null;
  const stats = analisis && "estadisticas" in analisis ? analisis.estadisticas : null;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Link to="/causas" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Volver a Causas
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-5 h-5 text-blue-600" />
            <span className="font-mono text-lg text-gray-500">{causa.rit}</span>
            <Badge className={estadoColor[causa.estado] || "bg-gray-100"}>
              {causa.estado}
            </Badge>
            {riesgo && (
              <Badge className={`${riesgo.bg} ${riesgo.color}`}>
                Riesgo: {riesgo.label}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{causa.caratula}</h1>
          <p className="text-gray-500 mt-1">
            {causa.tribunal}
            {causa.comuna && ` - ${causa.comuna}`}
            {causa.region && `, ${causa.region}`}
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
            <span>Materia: <strong>{causa.materia}</strong></span>
            {causa.etapa && <span>Etapa: <strong>{causa.etapa}</strong></span>}
            {causa.fechaIngreso && <span>Ingreso: <strong>{formatDate(causa.fechaIngreso)}</strong></span>}
            {causa.ruc && <span>RUC: <strong>{causa.ruc}</strong></span>}
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ListChecks className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.totalTareas}</p>
                <p className="text-xs text-gray-500">Tareas totales</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.tareasPendientes}</p>
                <p className="text-xs text-gray-500">Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.tareasVencidas}</p>
                <p className="text-xs text-gray-500">Vencidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-gray-500" />
              <div>
                <p className="text-2xl font-bold">{stats.diasSinMovimiento}</p>
                <p className="text-xs text-gray-500">Dias sin movimiento</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk factors */}
      {analisis && "factoresRiesgo" in analisis && (analisis.factoresRiesgo?.length ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Factores de Riesgo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {analisis.factoresRiesgo?.map((factor, i) => (
                <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {analisis && "recomendaciones" in analisis && (analisis.recomendaciones?.length ?? 0) > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recomendaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {analisis.recomendaciones?.map((rec, i) => (
                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tareas">
            Tareas {causa.tareas?.length ? `(${causa.tareas.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas {causa.alertas?.filter((a) => a.estado === "pendiente").length ? `(${causa.alertas.filter((a) => a.estado === "pendiente").length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notas">
            Notas {causa.notas?.length ? `(${causa.notas.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cronologia</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTimeline ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : !timeline || timeline.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay eventos registrados</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="relative pl-6">
                    {/* Vertical line */}
                    <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    {timeline.map((event) => {
                      const IconComp = tipoTimelineIcon[event.tipo] || CircleDot;
                      const categoriaColors: Record<string, string> = {
                        cronologia: "bg-blue-500",
                        tarea: "bg-green-500",
                        alerta: "bg-amber-500",
                      };
                      return (
                        <div key={`${event.categoria}-${event.id}`} className="relative pb-6 last:pb-0">
                          {/* Dot */}
                          <div className={`absolute -left-6 top-0.5 w-[22px] h-[22px] rounded-full flex items-center justify-center ${categoriaColors[event.categoria] || "bg-gray-500"}`}>
                            <IconComp className="w-3 h-3 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-gray-400 font-mono">{formatDate(event.fecha)}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {event.categoria}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{event.titulo}</p>
                            {event.descripcion && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.descripcion}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tareas Tab */}
        <TabsContent value="tareas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tareas</CardTitle>
            </CardHeader>
            <CardContent>
              {!causa.tareas || causa.tareas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay tareas asociadas</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {causa.tareas.map((t) => {
                      const vencida =
                        t.estado !== "completada" &&
                        t.estado !== "cancelada" &&
                        t.fechaVencimiento &&
                        String(t.fechaVencimiento) < new Date().toISOString().split("T")[0];
                      return (
                        <div
                          key={t.id}
                          className={`p-3 rounded-lg border ${vencida ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-gray-200 dark:border-gray-700"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {t.estado === "completada" ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                ) : vencida ? (
                                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                ) : (
                                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {t.titulo}
                                </span>
                              </div>
                              {t.descripcion && (
                                <p className="text-xs text-gray-500 ml-6 line-clamp-2">{t.descripcion}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1 ml-6">
                                <Badge className={`text-[10px] ${tareaEstadoColor[t.estado] || ""}`}>
                                  {t.estado}
                                </Badge>
                                <Badge className={`text-[10px] ${prioridadColor[t.prioridad] || ""}`}>
                                  {t.prioridad}
                                </Badge>
                                {t.fechaVencimiento && (
                                  <span className="text-[10px] text-gray-400">
                                    Vence: {formatDate(t.fechaVencimiento)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertas Tab */}
        <TabsContent value="alertas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alertas</CardTitle>
            </CardHeader>
            <CardContent>
              {!causa.alertas || causa.alertas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay alertas asociadas</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {causa.alertas
                      .sort((a, b) => {
                        // Pending first, then by priority
                        if (a.estado === "pendiente" && b.estado !== "pendiente") return -1;
                        if (a.estado !== "pendiente" && b.estado === "pendiente") return 1;
                        return 0;
                      })
                      .map((a) => (
                        <div
                          key={a.id}
                          className={`p-3 rounded-lg border ${a.estado === "pendiente" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20" : "border-gray-200 dark:border-gray-700"}`}
                        >
                          <div className="flex items-start gap-2">
                            <Bell
                              className={`w-4 h-4 shrink-0 mt-0.5 ${a.estado === "pendiente" ? "text-amber-500" : "text-gray-400"}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{a.titulo}</p>
                              {a.descripcion && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.descripcion}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`text-[10px] ${prioridadColor[a.prioridad] || ""}`}>
                                  {a.prioridad}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${a.estado === "pendiente" ? "border-amber-300 text-amber-600" : ""}`}
                                >
                                  {a.estado}
                                </Badge>
                                {a.fechaEvento && (
                                  <span className="text-[10px] text-gray-400">
                                    {formatDate(a.fechaEvento)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas Tab */}
        <TabsContent value="notas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              {!causa.notas || causa.notas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No hay notas asociadas</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {causa.notas.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={`text-[10px] ${notaTipoColor[n.tipo] || "bg-gray-100 text-gray-700"}`}>
                                {n.tipo}
                              </Badge>
                              {n.autor && (
                                <span className="text-[10px] text-gray-400">{n.autor}</span>
                              )}
                              <span className="text-[10px] text-gray-400">{formatDate(n.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {n.contenido}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upcoming deadlines */}
      {analisis && "proximosPlazos" in analisis && (analisis.proximosPlazos?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Proximos Plazos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analisis.proximosPlazos?.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{p.titulo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${prioridadColor[p.prioridad] || ""}`}>
                      {p.prioridad}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatDate(p.fechaVencimiento)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
