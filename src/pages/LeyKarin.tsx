import { Link } from "react-router";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  AlertTriangle,
  Users,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types & Constants ──────────────────────────────────────────
type EstadoDenuncia = "recepcionada" | "evaluacion" | "investigacion" | "remitida_dt" | "archivada" | "concluida";

const PIPELINE_STAGES: { key: EstadoDenuncia; label: string }[] = [
  { key: "recepcionada", label: "Recepcionada" },
  { key: "evaluacion", label: "Evaluacion" },
  { key: "investigacion", label: "Investigacion" },
  { key: "concluida", label: "Concluida" },
];

const NEXT_STATE: Partial<Record<EstadoDenuncia, EstadoDenuncia>> = {
  recepcionada: "evaluacion",
  evaluacion: "investigacion",
  investigacion: "concluida",
  remitida_dt: "concluida",
  concluida: "archivada",
};

const estadoColor: Record<string, string> = {
  recepcionada: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  evaluacion: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  investigacion: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  remitida_dt: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  archivada: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  concluida: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const estadoLabel: Record<string, string> = {
  recepcionada: "Recepcionada",
  evaluacion: "Evaluacion",
  investigacion: "Investigacion",
  remitida_dt: "Remitida DT",
  archivada: "Archivada",
  concluida: "Concluida",
};

const tipoLabel: Record<string, string> = {
  acoso_laboral: "Acoso laboral",
  acoso_sexual: "Acoso sexual",
  violencia_laboral: "Violencia laboral",
  discriminacion: "Discriminacion",
  otro: "Otro",
};

// ─── Helpers ────────────────────────────────────────────────────
function calcularDiasRestantes(fechaRecepcion: string | Date, plazo: number): number {
  const recepcionStr = typeof fechaRecepcion === "string"
    ? fechaRecepcion
    : (fechaRecepcion as Date).toISOString().split("T")[0];
  const recepcion = new Date(recepcionStr + "T00:00:00");
  const limite = new Date(recepcion);
  limite.setDate(limite.getDate() + plazo);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = limite.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function urgenciaColor(dias: number): string {
  if (dias < 0) return "text-red-600 dark:text-red-400";
  if (dias < 5) return "text-red-600 dark:text-red-400";
  if (dias < 15) return "text-orange-600 dark:text-orange-400";
  return "text-green-600 dark:text-green-400";
}

function urgenciaBadge(dias: number): { className: string; label: string } {
  if (dias < 0) return { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Vencido" };
  if (dias < 5) return { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Urgente" };
  if (dias < 15) return { className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", label: "Proximo" };
  return { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", label: "En plazo" };
}

function formatFechaCorta(fecha: string | Date): string {
  const str = typeof fecha === "string" ? fecha : (fecha as Date).toISOString().split("T")[0];
  return str;
}

// ─── Pipeline Component ─────────────────────────────────────────
function StatusPipeline({ estado }: { estado: string }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === estado);
  // For remitida_dt, highlight between investigacion and concluida
  const isRemitidaDt = estado === "remitida_dt";
  const isArchivada = estado === "archivada";

  return (
    <div className="flex items-center gap-0.5">
      {PIPELINE_STAGES.map((stage, i) => {
        let status: "done" | "current" | "pending" = "pending";
        if (isArchivada) {
          status = "done";
        } else if (isRemitidaDt) {
          if (i < 3) status = "done";
          else status = "pending";
        } else if (i < currentIndex) {
          status = "done";
        } else if (i === currentIndex) {
          status = "current";
        }

        return (
          <div key={stage.key} className="flex items-center">
            <div
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                status === "done"
                  ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                  : status === "current"
                  ? "bg-purple-100 border-purple-400 text-purple-800 font-semibold dark:bg-purple-900/30 dark:border-purple-600 dark:text-purple-200"
                  : "bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500"
              }`}
            >
              {stage.label}
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <ChevronRight className={`w-3 h-3 mx-0.5 ${
                status === "done" || status === "current"
                  ? "text-green-500 dark:text-green-400"
                  : "text-gray-300 dark:text-gray-600"
              }`} />
            )}
          </div>
        );
      })}
      {isRemitidaDt && (
        <div className="flex items-center ml-1">
          <Badge className="bg-orange-100 text-orange-700 text-xs dark:bg-orange-900/30 dark:text-orange-300">
            Remitida DT
          </Badge>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function LeyKarin() {
  const utils = trpc.useUtils();
  const {
    data: denunciasInfinite,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.leykarin.listar.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
    }
  );
  const denuncias = denunciasInfinite?.pages.flatMap((p) => p.items) ?? [];
  const { data: dashboard } = trpc.leykarin.dashboard.useQuery();

  const cambiarEstado = trpc.leykarin.cambiarEstado.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(`Estado actualizado a "${estadoLabel[variables.estado] || variables.estado}"`);
      utils.leykarin.listar.invalidate();
      utils.leykarin.dashboard.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();

  const [crearOpen, setCrearOpen] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState(`LK-${year}-001`);
  const [nuevoFechaRecepcion, setNuevoFechaRecepcion] = useState(today);
  const [nuevoTipo, setNuevoTipo] = useState("acoso_laboral");
  const [nuevoDenunciante, setNuevoDenunciante] = useState("");
  const [nuevoDenunciado, setNuevoDenunciado] = useState("");
  const [nuevoDescripcionHechos, setNuevoDescripcionHechos] = useState("");
  const [nuevoPrioridad, setNuevoPrioridad] = useState("media");

  const crearDenuncia = trpc.leykarin.crear.useMutation({
    onSuccess: () => {
      utils.leykarin.listar.invalidate();
      utils.leykarin.dashboard.invalidate();
      setCrearOpen(false);
      resetCrearForm();
      toast.success("Denuncia creada exitosamente");
    },
    onError: (err) => {
      toast.error("Error al crear denuncia: " + err.message);
    },
  });

  function resetCrearForm() {
    setNuevoCodigo(`LK-${year}-001`);
    setNuevoFechaRecepcion(today);
    setNuevoTipo("acoso_laboral");
    setNuevoDenunciante("");
    setNuevoDenunciado("");
    setNuevoDescripcionHechos("");
    setNuevoPrioridad("media");
  }

  function handleCrearSubmit(e: React.FormEvent) {
    e.preventDefault();
    crearDenuncia.mutate({
      codigo: nuevoCodigo,
      fechaRecepcion: nuevoFechaRecepcion,
      tipo: nuevoTipo,
      denunciante: nuevoDenunciante || undefined,
      denunciado: nuevoDenunciado,
      descripcionHechos: nuevoDescripcionHechos,
      prioridad: nuevoPrioridad,
    });
  }

  const estadosActivos: EstadoDenuncia[] = ["recepcionada", "evaluacion", "investigacion", "remitida_dt"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ley Karin - Ley 21.643</h1>
          <p className="text-gray-500">Gestion de denuncias de acoso laboral, sexual y violencia</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={crearOpen} onOpenChange={(v) => { setCrearOpen(v); if (!v) resetCrearForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Denuncia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nueva Denuncia Ley Karin</DialogTitle>
                <DialogDescription>Registre una nueva denuncia bajo Ley 21.643.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCrearSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nuevoCodigo">Código *</Label>
                    <Input id="nuevoCodigo" value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="LK-2026-001" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nuevoFechaRecepcion">Fecha de Recepción *</Label>
                    <Input id="nuevoFechaRecepcion" type="date" value={nuevoFechaRecepcion} onChange={(e) => setNuevoFechaRecepcion(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={nuevoTipo} onValueChange={setNuevoTipo}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acoso_laboral">Acoso laboral</SelectItem>
                        <SelectItem value="acoso_sexual">Acoso sexual</SelectItem>
                        <SelectItem value="violencia_laboral">Violencia laboral</SelectItem>
                        <SelectItem value="discriminacion">Discriminación</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select value={nuevoPrioridad} onValueChange={setNuevoPrioridad}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nuevoDenunciante">Denunciante (dejar vacío para anónimo)</Label>
                  <Input id="nuevoDenunciante" value={nuevoDenunciante} onChange={(e) => setNuevoDenunciante(e.target.value)} placeholder="Nombre del denunciante" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nuevoDenunciado">Denunciado *</Label>
                  <Input id="nuevoDenunciado" value={nuevoDenunciado} onChange={(e) => setNuevoDenunciado(e.target.value)} placeholder="Nombre del denunciado" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nuevoDescripcionHechos">Descripción de los Hechos *</Label>
                  <Textarea id="nuevoDescripcionHechos" value={nuevoDescripcionHechos} onChange={(e) => setNuevoDescripcionHechos(e.target.value)} placeholder="Describa los hechos denunciados..." required rows={4} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={crearDenuncia.isPending}>
                    {crearDenuncia.isPending ? "Creando..." : "Crear Denuncia"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link to="/ley-karin/protocolo">
              <FileText className="w-4 h-4 mr-2" />
              Generar protocolo para cliente
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dashboard.total}</p>
              <p className="text-xs text-gray-500">Total denuncias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{dashboard.activas}</p>
              <p className="text-xs text-gray-500">Activas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{dashboard.urgentes}</p>
              <p className="text-xs text-gray-500">Urgentes (&lt;5 dias)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <XCircle className="w-6 h-6 text-red-800 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-800">{dashboard.vencidas}</p>
              <p className="text-xs text-gray-500">Vencidas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ley Karin Summary */}
      <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-800 dark:text-purple-200 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Resumen Ley Karin
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-purple-700 dark:text-purple-300 space-y-2">
          <p><strong>Art. 1:</strong> Derecho a trabajo libre de acoso laboral, acoso sexual y violencia.</p>
          <p><strong>Art. 2:</strong> El empleador debe adoptar medidas de prevencion: reglamento interno, capacitacion, persona encargada de recibir denuncias.</p>
          <p><strong>Art. 3:</strong> La denuncia se inicia en 5 dias habiles, investigacion concluye en 30 dias habiles.</p>
          <p><strong>Art. 4:</strong> Multa de 1 a 100 UTM por incumplimiento de medidas preventivas.</p>
          <p><strong>Art. 5:</strong> Indemnizacion por dano moral y proteccion al denunciante contra represalias.</p>
        </CardContent>
      </Card>

      {/* Denuncias list */}
      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-3">
          {(denuncias || []).map((d) => {
            const esActiva = estadosActivos.includes(d.estado as EstadoDenuncia);
            const diasRestantes = esActiva
              ? calcularDiasRestantes(d.fechaRecepcion, d.diasPlazo ?? 30)
              : null;
            const nextState = NEXT_STATE[d.estado as EstadoDenuncia];
            const urg = diasRestantes !== null ? urgenciaBadge(diasRestantes) : null;

            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {/* Top row: code, estado badge, urgency, dias restantes */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Shield className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="font-mono text-sm text-gray-500">{d.codigo}</span>
                      <Badge className={estadoColor[d.estado] || "bg-gray-100"}>
                        {estadoLabel[d.estado] || d.estado}
                      </Badge>
                      {urg && (
                        <Badge className={urg.className}>{urg.label}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {diasRestantes !== null && (
                        <div className={`text-sm font-semibold flex items-center gap-1 ${urgenciaColor(diasRestantes)}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {diasRestantes < 0
                            ? `${Math.abs(diasRestantes)}d vencido`
                            : `${diasRestantes}d restantes`}
                        </div>
                      )}
                      {d.estado === "concluida" && (
                        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Concluida
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pipeline visualization */}
                  <StatusPipeline estado={d.estado} />

                  {/* Details row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">
                        Denunciante: {d.denunciante || "Anonimo"} | Denunciado: {d.denunciado}
                      </p>
                      <p className="text-xs text-gray-500">
                        {tipoLabel[d.tipo] || d.tipo}
                        {d.area ? ` | ${d.area}` : ""}
                        {" | Recepcion: "}
                        {formatFechaCorta(d.fechaRecepcion)}
                      </p>
                    </div>

                    {/* Quick action button */}
                    {nextState && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cambiarEstado.isPending}
                        onClick={() =>
                          cambiarEstado.mutate({ id: d.id, estado: nextState })
                        }
                        className="flex-shrink-0"
                      >
                        Avanzar a {estadoLabel[nextState] || nextState}
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {(!denuncias || denuncias.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay denuncias registradas</p>
          )}
          {hasNextPage && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
