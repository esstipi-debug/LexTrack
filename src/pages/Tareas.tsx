import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus, Check, AlertTriangle } from "lucide-react";

type EstadoFiltro = "todas" | "pendiente" | "en_progreso" | "completada";

const prioridadColor: Record<string, string> = {
  critica: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  alta: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  media: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  baja: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

const estadoLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_progreso: "En Progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

function formatFecha(fecha: string | Date | null): string {
  if (!fecha) return "";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-CL");
}

function esVencida(fecha: string | Date | null, estado: string): boolean {
  if (!fecha || estado === "completada" || estado === "cancelada") return false;
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d < hoy;
}

export default function Tareas() {
  const [filtro, setFiltro] = useState<EstadoFiltro>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [tipo, setTipo] = useState("otra");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [causaId, setCausaId] = useState("");

  const { data: tareas, isLoading } = trpc.tarea.listar.useQuery();
  const { data: causasData } = trpc.causa.listar.useQuery();
  const utils = trpc.useUtils();

  const crearMut = trpc.tarea.crear.useMutation({
    onSuccess: () => {
      utils.tarea.listar.invalidate();
      setDialogOpen(false);
      resetForm();
    },
  });

  const completarMut = trpc.tarea.completar.useMutation({
    onSuccess: () => utils.tarea.listar.invalidate(),
  });

  function resetForm() {
    setTitulo("");
    setDescripcion("");
    setPrioridad("media");
    setTipo("otra");
    setFechaVencimiento("");
    setCausaId("");
  }

  function handleCrear() {
    if (!titulo.trim()) return;
    crearMut.mutate({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      prioridad: prioridad as "baja" | "media" | "alta" | "critica",
      tipo: tipo as
        | "revision_documento"
        | "preparar_escrito"
        | "seguimiento_causa"
        | "revisar_resolucion"
        | "notificar_cliente"
        | "agendar_audiencia"
        | "investigar_norma"
        | "checklist_despido"
        | "checklist_finiquito"
        | "revisar_diario_oficial"
        | "otra",
      fechaVencimiento: fechaVencimiento || undefined,
      causaId: causaId ? Number(causaId) : undefined,
    });
  }

  const tareasFiltradas = (tareas || []).filter((t) => {
    if (filtro === "todas") return true;
    return t.estado === filtro;
  });

  const filtros: { key: EstadoFiltro; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "pendiente", label: "Pendientes" },
    { key: "en_progreso", label: "En Progreso" },
    { key: "completada", label: "Completadas" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tareas
          </h1>
          <p className="text-gray-500">Gestion de tareas y plazos</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Tarea</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="titulo">Titulo</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Titulo de la tarea"
                />
              </div>
              <div>
                <Label htmlFor="descripcion">Descripcion</Label>
                <Textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripcion opcional"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridad</Label>
                  <Select value={prioridad} onValueChange={setPrioridad}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Critica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="otra">Otra</SelectItem>
                      <SelectItem value="revision_documento">
                        Revision documento
                      </SelectItem>
                      <SelectItem value="preparar_escrito">
                        Preparar escrito
                      </SelectItem>
                      <SelectItem value="seguimiento_causa">
                        Seguimiento causa
                      </SelectItem>
                      <SelectItem value="revisar_resolucion">
                        Revisar resolucion
                      </SelectItem>
                      <SelectItem value="notificar_cliente">
                        Notificar cliente
                      </SelectItem>
                      <SelectItem value="agendar_audiencia">
                        Agendar audiencia
                      </SelectItem>
                      <SelectItem value="investigar_norma">
                        Investigar norma
                      </SelectItem>
                      <SelectItem value="checklist_despido">
                        Checklist despido
                      </SelectItem>
                      <SelectItem value="checklist_finiquito">
                        Checklist finiquito
                      </SelectItem>
                      <SelectItem value="revisar_diario_oficial">
                        Revisar diario oficial
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="fechaVencimiento">Fecha de vencimiento</Label>
                <Input
                  id="fechaVencimiento"
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                />
              </div>
              <div>
                <Label>Causa asociada (opcional)</Label>
                <Select value={causaId} onValueChange={setCausaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin causa asociada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin causa asociada</SelectItem>
                    {(causasData || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.rit} - {c.caratula}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleCrear} disabled={!titulo.trim() || crearMut.isPending}>
                {crearMut.isPending ? "Creando..." : "Crear Tarea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filters */}
      <div className="flex gap-2">
        {filtros.map((f) => (
          <Button
            key={f.key}
            variant={filtro === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando tareas...</p>
      ) : (
        <div className="space-y-2">
          {tareasFiltradas.map((t) => {
            const vencida = esVencida(t.fechaVencimiento, t.estado);
            return (
              <Card
                key={t.id}
                className={`${t.estado === "completada" ? "opacity-60" : ""} ${vencida ? "border-red-400 dark:border-red-600" : ""}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {vencida && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <ClipboardList className="w-4 h-4 text-gray-400" />
                      <span
                        className={`font-medium ${
                          t.estado === "completada"
                            ? "line-through text-gray-400"
                            : vencida
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {t.titulo}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {estadoLabel[t.estado] ?? t.estado}
                      </Badge>
                    </div>
                    {t.descripcion && (
                      <p className="text-sm text-gray-500 mt-1">
                        {t.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className={
                          prioridadColor[t.prioridad] || "bg-gray-100"
                        }
                      >
                        {t.prioridad}
                      </Badge>
                      {t.fechaVencimiento && (
                        <span
                          className={`text-xs ${vencida ? "text-red-500 font-semibold" : "text-gray-400"}`}
                        >
                          Vence: {formatFecha(t.fechaVencimiento)}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.estado !== "completada" && t.estado !== "cancelada" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completarMut.mutate({ id: t.id })}
                      disabled={completarMut.isPending}
                      className="shrink-0"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Completar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {tareasFiltradas.length === 0 && (
            <p className="text-gray-400 text-center py-8">No hay tareas</p>
          )}
        </div>
      )}
    </div>
  );
}
