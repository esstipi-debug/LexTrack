import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Link } from "react-router";

export default function Causas() {
  const { data: causas, isLoading } = trpc.causa.listar.useQuery();
  const [search, setSearch] = useState("");

  const filtered = causas?.filter(c =>
    !search || c.caratula?.toLowerCase().includes(search.toLowerCase()) || c.rit?.toLowerCase().includes(search.toLowerCase())
  );

  const estadoColor: Record<string, string> = {
    tramitacion: "bg-blue-100 text-blue-700",
    sentencia: "bg-green-100 text-green-700",
    ejecucion: "bg-amber-100 text-amber-700",
    concluida: "bg-gray-100 text-gray-700",
    archivada: "bg-gray-100 text-gray-500",
    notificacion: "bg-purple-100 text-purple-700",
    prueba: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Causas</h1>
          <p className="text-gray-500">Gestión de causas judiciales laborales</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por carátula o RIT..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400">Cargando causas...</p>
      ) : (
        <div className="grid gap-3">
          {(filtered || []).map((c) => (
            <Link key={c.id} to={`/causas/${c.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Gavel className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-mono text-gray-500">{c.rit}</span>
                        <Badge className={estadoColor[c.estado] || "bg-gray-100"}>{c.estado}</Badge>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{c.caratula}</h3>
                      <p className="text-sm text-gray-500">{c.tribunal} {c.comuna && `- ${c.comuna}`}</p>
                      <p className="text-xs text-gray-400 mt-1">Materia: {c.materia} | Ingreso: {c.fechaIngreso}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!filtered || filtered.length === 0) && (
            <p className="text-gray-400 text-center py-8">No se encontraron causas</p>
          )}
        </div>
      )}
    </div>
  );
}
