import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClipboardCheck, ListChecks, ArrowLeft, Play } from "lucide-react";

const tipoLabel: Record<string, string> = {
  despido_injustificado: "Despido injustificado",
  carta_aviso_despido: "Carta aviso despido",
  finiquito: "Finiquito",
  reclamacion_indemnizacion: "Reclamacion indemnizacion",
  accidente_laboral: "Accidente laboral",
  proteccion_derechos: "Proteccion derechos",
  despido_procedente: "Despido procedente",
  reclamacion_cotizaciones: "Reclamacion cotizaciones",
  despido_colectivo: "Despido colectivo",
  consulta_dt: "Consulta DT",
};

const categoriaColor: Record<string, string> = {
  documento: "bg-blue-100 text-blue-700",
  tramite: "bg-purple-100 text-purple-700",
  notificacion: "bg-yellow-100 text-yellow-700",
  plazo: "bg-red-100 text-red-700",
  verificacion: "bg-green-100 text-green-700",
  pago: "bg-amber-100 text-amber-700",
  consulta: "bg-cyan-100 text-cyan-700",
  otro: "bg-gray-100 text-gray-700",
};

export default function Checklists() {
  const {
    data: templatesInfinite,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.checklist.templates.useInfiniteQuery(
    { limit: 100 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
    }
  );
  const templates = templatesInfinite?.pages.flatMap((p) => p.items);

  // Dialog state for starting execution
  const [startOpen, setStartOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: number; nombre: string } | null>(null);
  const [startCausaId, setStartCausaId] = useState("");
  const [startTitulo, setStartTitulo] = useState("");

  // Active execution view
  const [activeExecution, setActiveExecution] = useState<{
    id: number;
    templateId: number;
    templateNombre: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const ejecutarMut = trpc.checklist.ejecutar.useMutation({
    onSuccess: (result) => {
      if (selectedTemplate) {
        setActiveExecution({
          id: result.id,
          templateId: selectedTemplate.id,
          templateNombre: selectedTemplate.nombre,
        });
      }
      setStartOpen(false);
      setStartCausaId("");
      setStartTitulo("");
    },
  });

  function openStartDialog(template: { id: number; nombre: string }) {
    setSelectedTemplate(template);
    setStartTitulo(template.nombre);
    setStartOpen(true);
  }

  function handleStart() {
    if (!selectedTemplate || !startTitulo.trim()) return;
    ejecutarMut.mutate({
      templateId: selectedTemplate.id,
      causaId: startCausaId ? Number(startCausaId) : undefined,
      titulo: startTitulo,
    });
  }

  // If there's an active execution, show that view
  if (activeExecution) {
    return (
      <ChecklistExecution
        ejecucionId={activeExecution.id}
        templateId={activeExecution.templateId}
        templateNombre={activeExecution.templateNombre}
        onBack={() => setActiveExecution(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checklists Legales</h1>
        <p className="text-gray-500">Listas de verificacion basadas en articulos del Codigo del Trabajo</p>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(templates || []).map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base">{t.nombre}</CardTitle>
                </div>
                <p className="text-sm text-gray-500">{t.descripcion}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ListChecks className="w-4 h-4" />
                  <span>Tipo: {tipoLabel[t.tipo] || t.tipo}</span>
                </div>
                {t.articulos && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.articulos.split(",").map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{a.trim()}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <Button size="sm" onClick={() => openStartDialog({ id: t.id, nombre: t.nombre })}>
                    <Play className="w-4 h-4 mr-1" /> Iniciar Checklist
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && (
            <p className="text-gray-400 text-center py-8 col-span-2">No hay templates disponibles</p>
          )}
          {hasNextPage && (
            <div className="flex justify-center py-4 col-span-2">
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

      {/* Start Execution Dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Checklist</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titulo</Label>
              <Input
                value={startTitulo}
                onChange={(e) => setStartTitulo(e.target.value)}
                placeholder="Titulo de la ejecucion"
              />
            </div>
            <div>
              <Label>ID de Causa (opcional)</Label>
              <Input
                value={startCausaId}
                onChange={(e) => setStartCausaId(e.target.value)}
                placeholder="Ej: 1"
                type="number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancelar</Button>
            <Button onClick={handleStart} disabled={ejecutarMut.isPending || !startTitulo.trim()}>
              {ejecutarMut.isPending ? "Iniciando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Execution View Component ────────────────────────────────────

function ChecklistExecution({
  ejecucionId,
  templateId,
  templateNombre,
  onBack,
}: {
  ejecucionId: number;
  templateId: number;
  templateNombre: string;
  onBack: () => void;
}) {
  const {
    data: itemsInfinite,
    isLoading: itemsLoading,
    fetchNextPage: fetchNextItems,
    hasNextPage: hasNextItems,
    isFetchingNextPage: isFetchingNextItems,
  } = trpc.checklist.items.useInfiniteQuery(
    { templateId, limit: 100 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
    }
  );
  const items = itemsInfinite?.pages.flatMap((p) => p.items);
  const { data: completados } = trpc.checklist.progreso.useQuery({ ejecucionId });

  const utils = trpc.useUtils();

  const completarMut = trpc.checklist.completarItem.useMutation({
    onSuccess: () => {
      utils.checklist.progreso.invalidate({ ejecucionId });
    },
  });

  // Build a set of completed item IDs
  const completedSet = new Set<number>();
  if (completados) {
    for (const c of completados) {
      if (c.completado) {
        completedSet.add(c.itemId);
      }
    }
  }

  const sortedItems = items ? [...items].sort((a, b) => a.orden - b.orden) : [];
  const totalItems = sortedItems.length;
  const completedCount = sortedItems.filter((item) => completedSet.has(item.id)).length;
  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  const obligatorioItems = sortedItems.filter((item) => item.esObligatorio);
  const obligatorioRemaining = obligatorioItems.filter((item) => !completedSet.has(item.id)).length;

  function handleToggle(itemId: number, currentlyCompleted: boolean) {
    completarMut.mutate({
      ejecucionId,
      itemId,
      completado: !currentlyCompleted,
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{templateNombre}</h1>
        <p className="text-gray-500 text-sm">Ejecucion #{ejecucionId}</p>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso</span>
            <span className="text-sm text-gray-500">{completedCount} de {totalItems} items completados</span>
          </div>
          <Progress value={progressPercent} />
          <p className="text-xs text-gray-400 mt-2">{progressPercent}% completado</p>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{completedCount}</p>
              <p className="text-xs text-gray-500">Completados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{totalItems - completedCount}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{obligatorioRemaining}</p>
              <p className="text-xs text-gray-500">Obligatorios pendientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items list */}
      {itemsLoading ? (
        <p className="text-gray-400">Cargando items...</p>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item) => {
            const isCompleted = completedSet.has(item.id);
            return (
              <Card key={item.id} className={isCompleted ? "opacity-70" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={() => handleToggle(item.id, isCompleted)}
                      disabled={completarMut.isPending}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isCompleted ? "line-through text-gray-400" : ""}`}>
                          {item.titulo}
                        </span>
                        {item.esObligatorio && (
                          <span className="text-red-500 text-xs font-bold">*</span>
                        )}
                        <Badge className={categoriaColor[item.categoria] || categoriaColor.otro}>
                          {item.categoria}
                        </Badge>
                      </div>
                      {item.descripcion && (
                        <p className="text-xs text-gray-500 mt-1">{item.descripcion}</p>
                      )}
                      {item.articuloLegal && (
                        <p className="text-xs text-blue-600 mt-1">Art. {item.articuloLegal}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {sortedItems.length === 0 && (
            <p className="text-gray-400 text-center py-8">No hay items en este checklist</p>
          )}
          {hasNextItems && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchNextItems()}
                disabled={isFetchingNextItems}
              >
                {isFetchingNextItems ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
