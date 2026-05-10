import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Alertas() {
  const { data: alertas, isLoading } = trpc.alerta.listar.useQuery();
  const utils = trpc.useUtils();
  const marcarLeida = trpc.alerta.marcarLeida.useMutation({
    onSuccess: () => utils.alerta.listar.invalidate(),
  });

  const prioridadColor: Record<string, string> = {
    critica: "bg-red-100 text-red-700",
    alta: "bg-orange-100 text-orange-700",
    media: "bg-amber-100 text-amber-700",
    baja: "bg-green-100 text-green-700",
  };

  const tipoLabel: Record<string, string> = {
    prazo_proximo: "Plazo próximo",
    cambio_normativo: "Cambio normativo",
    audiencia_programada: "Audiencia",
    system: "Sistema",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alertas</h1>
        <p className="text-gray-500">Notificaciones y plazos importantes</p>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando alertas...</p>
      ) : (
        <div className="space-y-2">
          {(alertas || []).map((a) => (
            <Card key={a.id} className={a.estado === "leida" ? "opacity-60" : "border-l-4 border-l-amber-400"}>
              <CardContent className="p-4 flex items-center gap-4">
                <Bell className={`w-5 h-5 ${a.estado === "pendiente" ? "text-amber-500" : "text-gray-300"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{a.titulo}</span>
                    <Badge className={prioridadColor[a.prioridad] || "bg-gray-100"}>{a.prioridad}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{a.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{tipoLabel[a.tipo] || a.tipo}</span>
                    {a.fechaVencimiento && <span className="text-xs text-red-400">Vence: {a.fechaVencimiento}</span>}
                  </div>
                </div>
                {a.estado === "pendiente" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => marcarLeida.mutate({ id: a.id })}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {(!alertas || alertas.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay alertas</p>
          )}
        </div>
      )}
    </div>
  );
}
