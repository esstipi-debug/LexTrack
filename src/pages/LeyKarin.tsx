import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Users, FileText, ArrowRight } from "lucide-react";

export default function LeyKarin() {
  const { data: denuncias, isLoading } = trpc.leykarin.listar.useQuery();
  const { data: stats } = trpc.leykarin.estadisticas.useQuery();

  const estadoColor: Record<string, string> = {
    recepcionada: "bg-blue-100 text-blue-700",
    evaluacion: "bg-amber-100 text-amber-700",
    investigacion: "bg-purple-100 text-purple-700",
    archivada: "bg-gray-100 text-gray-700",
    concluida: "bg-green-100 text-green-700",
  };

  const tipoLabel: Record<string, string> = {
    acoso_laboral: "Acoso laboral",
    acoso_sexual: "Acoso sexual",
    violencia_laboral: "Violencia laboral",
    discriminacion: "Discriminación",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ley Karin - Ley 21.643</h1>
          <p className="text-gray-500">Gestión de denuncias de acoso laboral, sexual y violencia</p>
        </div>
        <Button asChild>
          <Link to="/ley-karin/protocolo">
            <FileText className="w-4 h-4 mr-2" />
            Generar protocolo para cliente
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total denuncias</p>
            </CardContent>
          </Card>
          {Object.entries(stats.porEstado || {}).map(([estado, count]) => (
            <Card key={estado}>
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">{count as number}</p>
                <p className="text-xs text-gray-500 capitalize">{estado}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-800 dark:text-purple-200 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Resumen Ley Karin
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-purple-700 dark:text-purple-300 space-y-2">
          <p><strong>Art. 1:</strong> Derecho a trabajo libre de acoso laboral, acoso sexual y violencia.</p>
          <p><strong>Art. 2:</strong> El empleador debe adoptar medidas de prevención: reglamento interno, capacitación, persona encargada de recibir denuncias.</p>
          <p><strong>Art. 3:</strong> La denuncia se inicia en 5 días hábiles, investigación concluye en 30 días hábiles.</p>
          <p><strong>Art. 4:</strong> Multa de 1 a 100 UTM por incumplimiento de medidas preventivas.</p>
          <p><strong>Art. 5:</strong> Indemnización por daño moral y protección al denunciante contra represalias.</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {(denuncias || []).map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="font-mono text-sm text-gray-500">{d.codigo}</span>
                      <Badge className={estadoColor[d.estado] || "bg-gray-100"}>{d.estado}</Badge>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white mt-1">
                      Denunciante: {d.denunciante || "Anónimo"} | Denunciado: {d.denunciado}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tipoLabel[d.tipo] || d.tipo} | {d.area} | Recepción: {d.fechaRecepcion instanceof Date ? d.fechaRecepcion.toLocaleDateString("es-CL") : d.fechaRecepcion}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!denuncias || denuncias.length === 0) && (
            <p className="text-gray-400 text-center py-8">No hay denuncias registradas</p>
          )}
        </div>
      )}
    </div>
  );
}
