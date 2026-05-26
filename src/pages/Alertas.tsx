import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Eye,
  Archive,
  CheckCheck,
  AlertTriangle,
  Clock,
  BookOpen,
  Scale,
  FileText,
  Newspaper,
  Building,
  Info,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

type Prioridad = "baja" | "media" | "alta" | "critica";
type Estado = "pendiente" | "leida" | "archivada";
type Filtro = "todas" | Estado;

// ─── Helpers ─────────────────────────────────────────────────────

const PRIORIDAD_BADGE: Record<Prioridad, string> = {
  critica: "bg-red-100 text-red-700 border-red-200",
  alta: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-blue-100 text-blue-700 border-blue-200",
  baja: "bg-gray-100 text-gray-600 border-gray-200",
};

const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const TIPO_LABEL: Record<string, string> = {
  cambio_estado: "Cambio de Estado",
  nuevo_movimiento: "Nuevo Movimiento",
  nueva_resolucion: "Nueva Resolución",
  prazo_proximo: "Plazo Próximo",
  audiencia_programada: "Audiencia",
  notificacion_pendiente: "Notificación Pendiente",
  cambio_normativo: "Cambio Normativo",
  diario_oficial: "Diario Oficial",
  dt_dictamen: "Dictamen DT",
  system: "Sistema",
};

function TipoIcon({ tipo }: { tipo: string }) {
  const cls = "w-4 h-4 shrink-0";
  switch (tipo) {
    case "cambio_estado":
      return <Zap className={cls} />;
    case "prazo_proximo":
      return <Clock className={cls} />;
    case "audiencia_programada":
      return <Scale className={cls} />;
    case "nueva_resolucion":
    case "nuevo_movimiento":
      return <FileText className={cls} />;
    case "notificacion_pendiente":
      return <Bell className={cls} />;
    case "cambio_normativo":
      return <BookOpen className={cls} />;
    case "diario_oficial":
      return <Newspaper className={cls} />;
    case "dt_dictamen":
      return <Building className={cls} />;
    default:
      return <Info className={cls} />;
  }
}

function diasHastaVencimiento(fechaStr: string | null): number | null {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaStr);
  fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function VencimientoBadge({ fecha }: { fecha: string | null }) {
  if (!fecha) return null;
  const dias = diasHastaVencimiento(fecha);
  if (dias === null) return null;

  const label = new Date(fecha).toLocaleDateString("es-CL");

  if (dias < 0) {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
        Vencida hace {Math.abs(dias)}d ({label})
      </span>
    );
  }
  if (dias === 0) {
    return (
      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
        Vence HOY ({label})
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
        Vence en {dias}d ({label})
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-400">
      Vence: {label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function Alertas() {
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const { data: alertasData, isLoading } = trpc.alerta.listar.useQuery();
  const { data: dashboard } = trpc.alerta.dashboard.useQuery();
  const utils = trpc.useUtils();

  const invalidar = () => {
    utils.alerta.listar.invalidate();
    utils.alerta.dashboard.invalidate();
  };

  const marcarLeida = trpc.alerta.marcarLeida.useMutation({ onSuccess: invalidar });
  const marcarTodasLeidas = trpc.alerta.marcarTodasLeidas.useMutation({ onSuccess: invalidar });
  const archivar = trpc.alerta.archivar.useMutation({ onSuccess: invalidar });

  const alertas = alertasData ?? [];

  const filtradas = alertas.filter((a) => {
    if (filtro === "todas") return true;
    return a.estado === filtro;
  });

  const pendientes = alertas.filter((a) => a.estado === "pendiente");
  const altaPrioridad = pendientes.filter(
    (a) => a.prioridad === "critica" || a.prioridad === "alta"
  );

  const tabs: { key: Filtro; label: string; count?: number }[] = [
    { key: "todas", label: "Todas", count: alertas.length },
    { key: "pendientes", label: "Pendientes", count: pendientes.length },
    { key: "leida", label: "Leídas" },
    { key: "archivada", label: "Archivadas" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alertas</h1>
          <p className="text-gray-500 text-sm">Notificaciones y plazos importantes del sistema</p>
        </div>
        {pendientes.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => marcarTodasLeidas.mutate()}
            disabled={marcarTodasLeidas.isPending}
            className="gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas leídas
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Pendientes"
          value={dashboard?.totalPendientes ?? pendientes.length}
          icon={<Bell className="w-5 h-5 text-amber-600" />}
          color="bg-amber-50"
        />
        <SummaryCard
          label="Alta Prioridad"
          value={altaPrioridad.length}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <SummaryCard
          label="Leídas Hoy"
          value={dashboard?.totalLeidasHoy ?? 0}
          icon={<Eye className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <SummaryCard
          label="Archivadas"
          value={dashboard?.totalArchivadas ?? 0}
          icon={<Archive className="w-5 h-5 text-gray-500" />}
          color="bg-gray-50"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFiltro(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              filtro === tab.key
                ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-950"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filtro === tab.key
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay alertas en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((a) => {
            const isPendiente = a.estado === "pendiente";
            const isArchivada = a.estado === "archivada";
            const prioridadKey = a.prioridad as Prioridad;

            const borderColor =
              prioridadKey === "critica"
                ? "border-l-red-500"
                : prioridadKey === "alta"
                ? "border-l-orange-400"
                : prioridadKey === "media"
                ? "border-l-blue-400"
                : "border-l-gray-300";

            return (
              <Card
                key={a.id}
                className={`transition-opacity ${
                  isPendiente ? `border-l-4 ${borderColor}` : "opacity-60"
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`mt-0.5 ${
                      isPendiente ? "text-amber-500" : "text-gray-300"
                    }`}
                  >
                    <TipoIcon tipo={a.tipo} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {a.titulo}
                      </span>
                      <Badge
                        className={`text-xs px-2 py-0 border ${
                          PRIORIDAD_BADGE[prioridadKey] ?? "bg-gray-100 text-gray-500"
                        }`}
                        variant="outline"
                      >
                        {PRIORIDAD_LABEL[prioridadKey] ?? a.prioridad}
                      </Badge>
                      <span className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                      </span>
                    </div>

                    {a.descripcion && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">
                        {a.descripcion}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <VencimientoBadge fecha={a.fechaVencimiento} />
                      <span className="text-xs text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString("es-CL")}
                      </span>
                      {a.leidaAt && (
                        <span className="text-xs text-gray-400">
                          Leída: {new Date(a.leidaAt).toLocaleDateString("es-CL")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {isPendiente && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Marcar como leída"
                        onClick={() => marcarLeida.mutate({ id: a.id })}
                        disabled={marcarLeida.isPending}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    {!isArchivada && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Archivar alerta"
                        onClick={() => archivar.mutate({ id: a.id })}
                        disabled={archivar.isPending}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
