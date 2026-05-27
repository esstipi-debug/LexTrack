import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Newspaper, Calendar, Search, ChevronDown, ChevronUp, FileText, Building2 } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  ley: "Ley",
  decreto: "Decreto",
  resolucion: "Resolución",
  circular: "Circular",
  instruccion: "Instrucción",
  acuerdo: "Acuerdo",
  convenio: "Convenio",
};

const MATERIA_LABELS: Record<string, string> = {
  laboral: "Laboral",
  civil: "Civil",
  penal: "Penal",
  tributaria: "Tributaria",
  administrativa: "Administrativa",
  ambiental: "Ambiental",
  otra: "Otra",
};

const TIPO_COLORS: Record<string, string> = {
  ley: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  decreto: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  resolucion: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  circular: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  instruccion: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  acuerdo: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  convenio: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

const MATERIA_COLORS: Record<string, string> = {
  laboral: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  civil: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  penal: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  tributaria: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  administrativa: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  ambiental: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  otra: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatFecha(value: unknown): string {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(value as string);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("es-CL");
  } catch {
    return String(value);
  }
}

type Norma = {
  id: number;
  titulo: string;
  organismo: string;
  tipo: string;
  materia: string;
  fechaPublicacion: unknown;
  extracto?: string | null;
  anoNorma?: number | null;
  numeroNorma?: string | null;
  vigente?: boolean;
};

function NormaCard({ norma }: { norma: Norma }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtracto = Boolean(norma.extracto);

  return (
    <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Newspaper className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 dark:text-white leading-snug">
                {norma.titulo}
              </span>
              <Badge className={`text-xs shrink-0 ${TIPO_COLORS[norma.tipo] || "bg-gray-100 text-gray-600"}`}>
                {TIPO_LABELS[norma.tipo] || norma.tipo}
              </Badge>
              <Badge className={`text-xs shrink-0 ${MATERIA_COLORS[norma.materia] || "bg-gray-100 text-gray-600"}`}>
                {MATERIA_LABELS[norma.materia] || norma.materia}
              </Badge>
            </div>

            {/* Organism */}
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{norma.organismo}</span>
            </div>

            {/* Extracto preview */}
            {hasExtracto && (
              <p className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${expanded ? "" : "line-clamp-2"}`}>
                {norma.extracto}
              </p>
            )}

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatFecha(norma.fechaPublicacion)}</span>
              </div>
              {norma.numeroNorma && (
                <div className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>N° {norma.numeroNorma}</span>
                </div>
              )}
              {norma.vigente === false && (
                <Badge variant="outline" className="text-xs text-red-500 border-red-300">
                  Derogada
                </Badge>
              )}
            </div>

            {/* Expand toggle */}
            {hasExtracto && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Ocultar extracto
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Ver extracto completo
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiarioOficial() {
  const [termino, setTermino] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("");
  const [materiaFiltro, setMateriaFiltro] = useState<string>("");
  const [anoDesde, setAnoDesde] = useState<string>("");
  const [anoHasta, setAnoHasta] = useState<string>("");
  const [busquedaActiva, setBusquedaActiva] = useState(false);

  const { data: dashboard } = trpc.diarioOficial.dashboard.useQuery();
  const {
    data: normasListaInfinite,
    isLoading: loadingLista,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.diarioOficial.listar.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
      enabled: !busquedaActiva,
    }
  );
  const normasLista = normasListaInfinite?.pages.flatMap((p) => p.items);
  const { data: normasBusqueda, isLoading: loadingBusqueda } = trpc.diarioOficial.buscar.useQuery(
    {
      termino: termino || undefined,
      tipo: tipoFiltro || undefined,
      materia: materiaFiltro || undefined,
      anoDesde: anoDesde ? parseInt(anoDesde) : undefined,
      anoHasta: anoHasta ? parseInt(anoHasta) : undefined,
    },
    { enabled: busquedaActiva }
  );

  const normas = busquedaActiva ? normasBusqueda : normasLista;
  const isLoading = busquedaActiva ? loadingBusqueda : loadingLista;

  const handleBuscar = () => {
    setBusquedaActiva(true);
  };

  const handleLimpiar = () => {
    setTermino("");
    setTipoFiltro("");
    setMateriaFiltro("");
    setAnoDesde("");
    setAnoHasta("");
    setBusquedaActiva(false);
  };

  const hayFiltros = termino || tipoFiltro || materiaFiltro || anoDesde || anoHasta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diario Oficial</h1>
        <p className="text-gray-500">Monitoreo de normas publicadas en el Diario Oficial de Chile</p>
      </div>

      {/* Summary cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-gray-500">Total Normas</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {dashboard.total}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Normas Laborales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                {dashboard.laboralesTotal}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-gray-500">Última Publicación</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatFecha(dashboard.ultimaPublicacion)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats breakdown */}
      {dashboard && dashboard.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(dashboard.porMateria).map(([materia, count]) => (
            <Badge
              key={materia}
              className={`cursor-pointer text-xs ${MATERIA_COLORS[materia] || "bg-gray-100 text-gray-600"}`}
              onClick={() => {
                setMateriaFiltro(materia);
                setBusquedaActiva(true);
              }}
            >
              {MATERIA_LABELS[materia] || materia}: {count as number}
            </Badge>
          ))}
        </div>
      )}

      {/* Search and filters */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por título o extracto..."
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                className="pl-9"
              />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los tipos</SelectItem>
                  <SelectItem value="ley">Ley</SelectItem>
                  <SelectItem value="decreto">Decreto</SelectItem>
                  <SelectItem value="resolucion">Resolución</SelectItem>
                  <SelectItem value="circular">Circular</SelectItem>
                  <SelectItem value="instruccion">Instrucción</SelectItem>
                  <SelectItem value="acuerdo">Acuerdo</SelectItem>
                  <SelectItem value="convenio">Convenio</SelectItem>
                </SelectContent>
              </Select>

              <Select value={materiaFiltro} onValueChange={setMateriaFiltro}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Materia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las materias</SelectItem>
                  <SelectItem value="laboral">Laboral</SelectItem>
                  <SelectItem value="civil">Civil</SelectItem>
                  <SelectItem value="penal">Penal</SelectItem>
                  <SelectItem value="tributaria">Tributaria</SelectItem>
                  <SelectItem value="administrativa">Administrativa</SelectItem>
                  <SelectItem value="ambiental">Ambiental</SelectItem>
                  <SelectItem value="otra">Otra</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Año desde"
                value={anoDesde}
                onChange={(e) => setAnoDesde(e.target.value)}
                className="w-28"
                type="number"
                min={1990}
                max={new Date().getFullYear()}
              />

              <Input
                placeholder="Año hasta"
                value={anoHasta}
                onChange={(e) => setAnoHasta(e.target.value)}
                className="w-28"
                type="number"
                min={1990}
                max={new Date().getFullYear()}
              />

              <Button onClick={handleBuscar} size="sm">
                <Search className="w-4 h-4 mr-1" />
                Buscar
              </Button>

              {hayFiltros && (
                <Button onClick={handleLimpiar} size="sm" variant="outline">
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-8">Cargando normas...</p>
      ) : (
        <div className="space-y-2">
          {busquedaActiva && normas && (
            <p className="text-sm text-gray-500">
              {normas.length} resultado{normas.length !== 1 ? "s" : ""} encontrado{normas.length !== 1 ? "s" : ""}
            </p>
          )}
          {(normas || []).map((n) => (
            <NormaCard key={n.id} norma={n as Norma} />
          ))}
          {(!normas || normas.length === 0) && (
            <p className="text-gray-400 text-center py-8">
              {busquedaActiva ? "No se encontraron normas con los filtros aplicados" : "No hay normas registradas"}
            </p>
          )}
          {!busquedaActiva && hasNextPage && (
            <div className="flex justify-center py-4">
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
    </div>
  );
}
