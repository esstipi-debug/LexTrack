import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList } from "lucide-react";

export default function Tareas() {
  const { data: tareas, isLoading } = trpc.tarea.listar.useQuery();
  const utils = trpc.useUtils();
  const updateMut = trpc.tarea.actualizarEstado.useMutation({
    onSuccess: () => utils.tarea.listar.invalidate(),
  });

  const prioridadColor: Record<string, string> = {
    critica: "bg-red-100 text-red-700",
    alta: "bg-orange-100 text-orange-700",
    media: "bg-amber-100 text-amber-700",
    baja: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tareas</h1>
        <p className="text-gray-500">Gestión de tareas y plazos</p>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando tareas...</p>
      ) : (
        <div className="space-y-2">
          {(tareas || []).map((t) => (
            <Card key={t.id} className={t.estado === "completada" ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox
                  checked={t.estado === "completada"}
                  onCheckedChange={(checked) => {
                    updateMut.mutate({ id: t.id, estado: checked ? "completada" : "pendiente" });
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-gray-400" />
                    <span className={`font-medium ${t.estado === "completada" ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
                      {t.titulo}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{t.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={prioridadColor[t.prioridad] || "bg-gray-100"}>{t.prioridad}</Badge>
                    {t.fechaVencimiento && (
                      <span className="text-xs text-gray-400">Vence: {t.fechaVencimiento instanceof Date ? t.fechaVencimiento.toLocaleDateString("es-CL") : t.fechaVencimiento}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!tareas || tareas.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay tareas</p>
          )}
        </div>
      )}
    </div>
  );
}
