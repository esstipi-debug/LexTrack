import { useState } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Edit, Plus } from "lucide-react";

const estadoOptions = [
  "tramitacion",
  "notificacion",
  "prueba",
  "sentencia",
  "ejecucion",
  "concluida",
  "archivada",
] as const;

const estadoColor: Record<string, string> = {
  tramitacion: "bg-blue-100 text-blue-700",
  sentencia: "bg-green-100 text-green-700",
  ejecucion: "bg-amber-100 text-amber-700",
  concluida: "bg-gray-100 text-gray-700",
  archivada: "bg-gray-100 text-gray-500",
  notificacion: "bg-purple-100 text-purple-700",
  prueba: "bg-orange-100 text-orange-700",
};

const tipoNotaOptions = ["general", "estrategia", "cliente", "procesal", "evidencia"] as const;

export default function CausaDetalle() {
  const { id } = useParams<{ id: string }>();
  const causaId = Number(id);

  const utils = trpc.useUtils();
  const { data: causa, isLoading } = trpc.causa.obtener.useQuery({ id: causaId });

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editEstado, setEditEstado] = useState("");
  const [editEtapa, setEditEtapa] = useState("");
  const [editCaratula, setEditCaratula] = useState("");
  const [editTribunal, setEditTribunal] = useState("");

  // Nota form state
  const [notaTipo, setNotaTipo] = useState<string>("general");
  const [notaContenido, setNotaContenido] = useState("");

  // Tarea dialog state
  const [tareaOpen, setTareaOpen] = useState(false);
  const [tareaTitulo, setTareaTitulo] = useState("");
  const [tareaPrioridad, setTareaPrioridad] = useState("media");
  const [tareaFecha, setTareaFecha] = useState("");

  const actualizarMut = trpc.causa.actualizar.useMutation({
    onSuccess: () => {
      utils.causa.obtener.invalidate({ id: causaId });
    },
  });

  const crearNotaMut = trpc.causa.crearNota.useMutation({
    onSuccess: () => {
      utils.causa.obtener.invalidate({ id: causaId });
      setNotaContenido("");
      setNotaTipo("general");
    },
  });

  const crearTareaMut = trpc.tarea.crear.useMutation({
    onSuccess: () => {
      utils.causa.obtener.invalidate({ id: causaId });
      setTareaOpen(false);
      setTareaTitulo("");
      setTareaPrioridad("media");
      setTareaFecha("");
    },
  });

  if (isLoading) {
    return <p className="text-gray-400 p-4">Cargando causa...</p>;
  }

  if (!causa) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Causa no encontrada</p>
        <Link to="/app/causas" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a causas
        </Link>
      </div>
    );
  }

  function openEditDialog() {
    if (!causa) return;
    setEditEstado(causa.estado);
    setEditEtapa(causa.etapa || "");
    setEditCaratula(causa.caratula);
    setEditTribunal(causa.tribunal);
    setEditOpen(true);
  }

  function handleEditSave() {
    actualizarMut.mutate({
      id: causaId,
      datos: {
        estado: editEstado,
        etapa: editEtapa || null,
        caratula: editCaratula,
        tribunal: editTribunal,
      },
    });
    setEditOpen(false);
  }

  function handleEstadoChange(newEstado: string) {
    actualizarMut.mutate({
      id: causaId,
      datos: { estado: newEstado },
    });
  }

  function handleNotaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notaContenido.trim()) return;
    crearNotaMut.mutate({
      causaId,
      contenido: notaContenido,
      tipo: notaTipo,
    });
  }

  function handleTareaSubmit() {
    if (!tareaTitulo.trim()) return;
    crearTareaMut.mutate({
      titulo: tareaTitulo,
      prioridad: tareaPrioridad,
      fechaVencimiento: tareaFecha || undefined,
      causaId,
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/app/causas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{causa.caratula}</h1>
          <p className="text-sm text-gray-500">
            {causa.rit} | {causa.tribunal} {causa.comuna && `- ${causa.comuna}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={causa.estado} onValueChange={handleEstadoChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {estadoOptions.map((e) => (
                <SelectItem key={e} value={e}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Edit className="w-4 h-4 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Estado</p>
            <Badge className={estadoColor[causa.estado] || "bg-gray-100"}>{causa.estado}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Materia</p>
            <p className="text-sm font-medium">{causa.materia}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Etapa</p>
            <p className="text-sm font-medium">{causa.etapa || "Sin etapa"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">Ingreso</p>
            <p className="text-sm font-medium">{causa.fechaIngreso || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cronologia">
        <TabsList>
          <TabsTrigger value="cronologia">Cronologia</TabsTrigger>
          <TabsTrigger value="tareas">Tareas ({causa.tareas?.length || 0})</TabsTrigger>
          <TabsTrigger value="notas">Notas ({causa.notas?.length || 0})</TabsTrigger>
          <TabsTrigger value="alertas">Alertas ({causa.alertas?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Cronologia tab */}
        <TabsContent value="cronologia">
          <div className="space-y-2">
            {causa.cronologia && causa.cronologia.length > 0 ? (
              causa.cronologia.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{c.tipo}</Badge>
                      <span className="text-xs text-gray-400">{c.fecha}</span>
                    </div>
                    <p className="text-sm font-medium">{c.titulo}</p>
                    {c.descripcion && <p className="text-xs text-gray-500 mt-1">{c.descripcion}</p>}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">Sin movimientos registrados</p>
            )}
          </div>
        </TabsContent>

        {/* Tareas tab */}
        <TabsContent value="tareas">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTareaOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Nueva Tarea
              </Button>
            </div>
            {causa.tareas && causa.tareas.length > 0 ? (
              causa.tareas.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.titulo}</p>
                        {t.descripcion && <p className="text-xs text-gray-500">{t.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t.prioridad}</Badge>
                        <Badge className={t.estado === "completada" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                          {t.estado}
                        </Badge>
                      </div>
                    </div>
                    {t.fechaVencimiento && (
                      <p className="text-xs text-gray-400 mt-1">Vence: {t.fechaVencimiento}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">Sin tareas asignadas</p>
            )}
          </div>
        </TabsContent>

        {/* Notas tab */}
        <TabsContent value="notas">
          <div className="space-y-3">
            {/* Add nota form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Agregar nota</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleNotaSubmit} className="space-y-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={notaTipo} onValueChange={setNotaTipo}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tipoNotaOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contenido</Label>
                    <Textarea
                      value={notaContenido}
                      onChange={(e) => setNotaContenido(e.target.value)}
                      placeholder="Escribe una nota..."
                      rows={3}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={crearNotaMut.isPending || !notaContenido.trim()}>
                    {crearNotaMut.isPending ? "Guardando..." : "Guardar nota"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing notas */}
            {causa.notas && causa.notas.length > 0 ? (
              causa.notas.map((n) => (
                <Card key={n.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{n.tipo}</Badge>
                      <span className="text-xs text-gray-400">
                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-sm">{n.contenido}</p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-400 text-center py-4">Sin notas</p>
            )}
          </div>
        </TabsContent>

        {/* Alertas tab */}
        <TabsContent value="alertas">
          <div className="space-y-2">
            {causa.alertas && causa.alertas.length > 0 ? (
              causa.alertas.map((a) => (
                <Card key={a.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{a.tipo}</Badge>
                      <Badge className={a.prioridad === "alta" || a.prioridad === "critica" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}>
                        {a.prioridad}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{a.titulo}</p>
                    {a.descripcion && <p className="text-xs text-gray-500">{a.descripcion}</p>}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">Sin alertas</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Causa Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Causa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Estado</Label>
              <Select value={editEstado} onValueChange={setEditEstado}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {estadoOptions.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e.charAt(0).toUpperCase() + e.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etapa</Label>
              <Input value={editEtapa} onChange={(e) => setEditEtapa(e.target.value)} placeholder="Etapa procesal" />
            </div>
            <div>
              <Label>Caratula</Label>
              <Input value={editCaratula} onChange={(e) => setEditCaratula(e.target.value)} />
            </div>
            <div>
              <Label>Tribunal</Label>
              <Input value={editTribunal} onChange={(e) => setEditTribunal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={actualizarMut.isPending}>
              {actualizarMut.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nueva Tarea Dialog */}
      <Dialog open={tareaOpen} onOpenChange={setTareaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titulo</Label>
              <Input value={tareaTitulo} onChange={(e) => setTareaTitulo(e.target.value)} placeholder="Titulo de la tarea" />
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={tareaPrioridad} onValueChange={setTareaPrioridad}>
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
              <Label>Fecha de vencimiento</Label>
              <Input type="date" value={tareaFecha} onChange={(e) => setTareaFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTareaOpen(false)}>Cancelar</Button>
            <Button onClick={handleTareaSubmit} disabled={crearTareaMut.isPending || !tareaTitulo.trim()}>
              {crearTareaMut.isPending ? "Creando..." : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
