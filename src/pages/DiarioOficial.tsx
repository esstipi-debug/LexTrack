import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Calendar } from "lucide-react";

export default function DiarioOficial() {
  const { data: normas, isLoading } = trpc.diarioOficial.listar.useQuery();
  const { data: stats } = trpc.diarioOficial.estadisticas.useQuery();

  const tipoLabel: Record<string, string> = {
    ley: "Ley",
    decreto: "Decreto",
    resolucion: "Resolución",
    circular: "Circular",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diario Oficial</h1>
        <p className="text-gray-500">Monitoreo de normas publicadas</p>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.porMateria || {}).map(([materia, count]) => (
            <Badge key={materia} variant="outline">
              {materia}: {count as number}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {(normas || []).map((n) => (
            <Card key={n.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Newspaper className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{n.titulo}</span>
                      <Badge variant="outline">{tipoLabel[n.tipo] || n.tipo}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">{n.organismo}</p>
                    {n.extracto && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{n.extracto}</p>}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>Publicación: {n.fechaPublicacion instanceof Date ? n.fechaPublicacion.toLocaleDateString("es-CL") : n.fechaPublicacion}</span>
                      <span>Materia: {n.materia}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!normas || normas.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay normas registradas</p>
          )}
        </div>
      )}
    </div>
  );
}
