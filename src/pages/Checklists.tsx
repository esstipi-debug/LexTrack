import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, ListChecks } from "lucide-react";

export default function Checklists() {
  const { data: templates, isLoading } = trpc.checklist.templates.useQuery();

  const tipoLabel: Record<string, string> = {
    despido_injustificado: "Despido injustificado",
    carta_aviso_despido: "Carta aviso despido",
    finiquito: "Finiquito",
    reclamacion_indemnizacion: "Reclamación indemnización",
    accidente_laboral: "Accidente laboral",
    proteccion_derechos: "Protección derechos",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checklists Legales</h1>
        <p className="text-gray-500">Listas de verificación basadas en artículos del Código del Trabajo</p>
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
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && (
            <p className="text-gray-400 text-center py-8 col-span-2">No hay templates disponibles</p>
          )}
        </div>
      )}
    </div>
  );
}
