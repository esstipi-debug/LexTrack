import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function Honorarios() {
  const { data: honorarios, isLoading } = trpc.honorario.listar.useQuery();
  const { data: stats } = trpc.honorario.estadisticas.useQuery();

  const estadoColor: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-700",
    pagado_parcial: "bg-blue-100 text-blue-700",
    pagado: "bg-green-100 text-green-700",
    vencido: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Honorarios y Cobranza</h1>
        <p className="text-gray-500">Gestión de honorarios y estado de cobranza</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-500">Facturado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${stats.totalFacturado.toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-500">Pagado</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${stats.totalPagado.toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-gray-500">Por cobrar</span>
              </div>
              <p className="text-xl font-bold text-amber-600">${stats.porCobrar.toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-500">Documentos</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalDocumentos}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {(honorarios || []).map((h) => (
            <Card key={h.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{h.concepto}</span>
                      <Badge className={estadoColor[h.estado] || "bg-gray-100"}>{h.estado}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">Cliente: {h.cliente}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">${h.monto.toLocaleString("es-CL")}</p>
                    {h.montoPagado && h.montoPagado > 0 && (
                      <p className="text-xs text-gray-400">Pagado: ${h.montoPagado.toLocaleString("es-CL")}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!honorarios || honorarios.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay honorarios registrados</p>
          )}
        </div>
      )}
    </div>
  );
}
