import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Gavel,
  RefreshCw,
  Download,
  Building2,
  Calendar,
  Users,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

type PjudCausaResult = {
  rit: string;
  ruc: string;
  caratula: string;
  tribunal: string;
  estado: string;
  etapa: string;
  fechaIngreso: string;
  ultimoMovimiento: {
    fecha: string;
    tipo: string;
    descripcion: string;
  } | null;
  litigantes: string[];
};

export default function PoderJudicial() {
  const [searchType, setSearchType] = useState<"rit" | "rut">("rit");
  const [searchValue, setSearchValue] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Queries
  const {
    data: ritResult,
    isLoading: ritLoading,
    error: ritError,
  } = trpc.pjud.consultar.useQuery(
    { rit: activeQuery },
    { enabled: searchType === "rit" && activeQuery.length > 0 },
  );

  const {
    data: rutResults,
    isLoading: rutLoading,
    error: rutError,
  } = trpc.pjud.buscarPorRut.useQuery(
    { rut: activeQuery },
    { enabled: searchType === "rut" && activeQuery.length > 0 },
  );

  // Local causas for comparison
  const { data: localCausas } = trpc.causa.listar.useQuery();

  // Mutations
  const importarMutation = trpc.pjud.importar.useMutation();
  const sincronizarMutation = trpc.pjud.sincronizar.useMutation();
  const sincronizarTodasMutation = trpc.pjud.sincronizarTodas.useMutation();

  const isLoading = ritLoading || rutLoading;
  const results: PjudCausaResult[] =
    searchType === "rit"
      ? ritResult
        ? [ritResult]
        : []
      : rutResults || [];

  function handleSearch() {
    if (searchValue.trim()) {
      setActiveQuery(searchValue.trim());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function handleImportar(causa: PjudCausaResult) {
    importarMutation.mutate({
      rit: causa.rit,
      ruc: causa.ruc,
      caratula: causa.caratula,
      tribunal: causa.tribunal,
      estado: causa.estado,
      etapa: causa.etapa,
      fechaIngreso: causa.fechaIngreso,
      litigantes: causa.litigantes.join(", "),
    });
  }

  function handleSincronizar(causaId: number) {
    setSyncingId(causaId);
    sincronizarMutation.mutate(
      { causaId },
      { onSettled: () => setSyncingId(null) },
    );
  }

  function findLocalCausa(rit: string) {
    return localCausas?.find(
      (c) => c.rit.toLowerCase() === rit.toLowerCase(),
    );
  }

  const estadoColor: Record<string, string> = {
    Tramitacion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    "En acuerdo": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Sentenciada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    Cumplimiento: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    Archivada: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Poder Judicial
          </h1>
          <p className="text-gray-500">
            Consulta unificada de causas - consultaunificada.pjud.cl
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => sincronizarTodasMutation.mutate()}
          disabled={sincronizarTodasMutation.isPending}
        >
          {sincronizarTodasMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sincronizar todas
        </Button>
      </div>

      {/* Search controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-3">
            <Button
              variant={searchType === "rit" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("rit");
                setActiveQuery("");
                setSearchValue("");
              }}
            >
              <Gavel className="w-4 h-4 mr-1" />
              Buscar por RIT
            </Button>
            <Button
              variant={searchType === "rut" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSearchType("rut");
                setActiveQuery("");
                setSearchValue("");
              }}
            >
              <Users className="w-4 h-4 mr-1" />
              Buscar por RUT
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchType === "rit"
                    ? "Ingrese RIT (ej: O-1234-2025)"
                    : "Ingrese RUT (ej: 12.345.678-9)"
                }
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={!searchValue.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync all results */}
      {sincronizarTodasMutation.isSuccess && sincronizarTodasMutation.data && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                Sincronizacion masiva completada
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {sincronizarTodasMutation.data.length} causa(s) procesada(s).{" "}
              {
                sincronizarTodasMutation.data.filter(
                  (r) => r.cambios.nuevosMovimientos > 0 || r.cambios.estadoCambio,
                ).length
              }{" "}
              con cambios detectados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sync single result */}
      {sincronizarMutation.isSuccess && sincronizarMutation.data && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                Sincronizacion completada: {sincronizarMutation.data.rit}
              </span>
            </div>
            {sincronizarMutation.data.cambios.estadoCambio && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Estado cambio de &quot;{sincronizarMutation.data.cambios.estadoCambio.anterior}&quot; a &quot;{sincronizarMutation.data.cambios.estadoCambio.nuevo}&quot;
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {sincronizarMutation.data.cambios.nuevosMovimientos} nuevo(s) movimiento(s) detectado(s).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Import success */}
      {importarMutation.isSuccess && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                Causa importada exitosamente
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-500">Consultando Poder Judicial...</span>
        </div>
      )}

      {/* Error */}
      {(ritError || rutError) && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>Error al consultar: {(ritError || rutError)?.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!isLoading && activeQuery && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {results.length} resultado(s) encontrado(s)
          </h2>

          {results.map((causa, idx) => {
            const local = findLocalCausa(causa.rit);
            return (
              <Card key={`${causa.rit}-${idx}`} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Gavel className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">
                          {causa.rit}
                        </span>
                        <Badge
                          className={
                            estadoColor[causa.estado] ||
                            "bg-gray-100 text-gray-600"
                          }
                        >
                          {causa.estado}
                        </Badge>
                        {local && (
                          <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200">
                            En LexTrack
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">
                        {causa.caratula}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2">
                      {local ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSincronizar(local.id)}
                          disabled={syncingId === local.id}
                        >
                          {syncingId === local.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Sincronizar
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleImportar(causa)}
                          disabled={importarMutation.isPending}
                        >
                          {importarMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          Importar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PJUD details */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Building2 className="w-4 h-4 shrink-0" />
                        <span>{causa.tribunal}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>Ingreso: {causa.fechaIngreso}</span>
                      </div>
                      {causa.ruc && (
                        <p className="text-sm text-gray-500">
                          RUC: {causa.ruc}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        Etapa: {causa.etapa}
                      </p>
                      {causa.litigantes.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Users className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{causa.litigantes.join(" vs. ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Last movimiento */}
                    {causa.ultimoMovimiento && (
                      <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                          Ultimo movimiento
                        </p>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {causa.ultimoMovimiento.tipo}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {causa.ultimoMovimiento.descripcion}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {causa.ultimoMovimiento.fecha}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status comparison with local */}
                  {local && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-500 mb-2 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        Comparacion local vs PJUD
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">
                            Estado local
                          </p>
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {local.estado}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">
                            Estado PJUD
                          </p>
                          <Badge
                            className={
                              estadoColor[causa.estado] ||
                              "bg-gray-100 text-gray-600"
                            }
                          >
                            {causa.estado}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">
                            Ultimo mov. local
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            {local.fechaUltimoMovimiento || "Sin datos"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">
                            Ultimo mov. PJUD
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            {causa.ultimoMovimiento?.fecha || "Sin datos"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* No results */}
      {!isLoading &&
        activeQuery &&
        results.length === 0 &&
        !ritError &&
        !rutError && (
          <div className="text-center py-12">
            <Gavel className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500">
              No se encontraron resultados para &quot;{activeQuery}&quot;
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchType === "rit"
                ? "Verifica el formato del RIT (ej: O-1234-2025)"
                : "Verifica el formato del RUT (ej: 12.345.678-9)"}
            </p>
          </div>
        )}

      {/* Empty state */}
      {!activeQuery && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">
            Consulta el estado de causas directamente desde el Poder Judicial
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Busca por RIT o RUT para ver el estado actual de una causa
          </p>
        </div>
      )}
    </div>
  );
}
