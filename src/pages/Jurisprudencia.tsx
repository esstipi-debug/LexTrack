import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Scale, Search, Gavel } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useDebounce } from "@/hooks/use-debounce";

export default function Jurisprudencia() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  // TODO: upgrade to useInfiniteQuery with "Cargar más" pagination.
  const { data: allJurisData } = trpc.jurisprudencia.listar.useQuery({ limit: 20 });
  const allJuris = allJurisData?.items ?? [];
  const { data: searchResults, isLoading } = trpc.jurisprudencia.buscar.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length > 2 }
  );

  const displayData = debouncedQuery.length > 2 ? searchResults : allJuris;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jurisprudencia</h1>
        <p className="text-gray-500">Fallos y sentencias laborales chilenas</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por materia, tribunal, RIT..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading && debouncedQuery.length > 2 && <p className="text-gray-400">Buscando...</p>}

        {(displayData || []).map((j) => (
          <Card key={j.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-mono text-gray-500">{j.rit}</span>
              </div>
              <CardTitle className="text-base">{j.caratula}</CardTitle>
              <p className="text-sm text-gray-500">{j.tribunal}</p>
            </CardHeader>
            <CardContent>
              {j.extracto && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <Gavel className="w-4 h-4" /> Extracto
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{j.extracto}</p>
                </div>
              )}
              <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-hidden">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>
                    {j.contenido.substring(0, 500) + "..."}
                  </ReactMarkdown>
                </div>
              </div>
              {j.normasAplicadas && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {j.normasAplicadas.split(",").map((n, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                      {n.trim()}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {(!displayData || displayData.length === 0) && !isLoading && (
          <p className="text-gray-400 text-center py-8">
            {debouncedQuery.length > 2 ? "No se encontraron resultados" : "No hay jurisprudencia registrada"}
          </p>
        )}
      </div>
    </div>
  );
}
