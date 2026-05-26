import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Search, Sparkles, BookOpen, Scale, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SearchResult {
  id: number;
  articulo?: string | null;
  titulo?: string | null;
  norma?: string | null;
  contenido: string;
  score: number;
}

interface JurisResult {
  id: number;
  caratula?: string | null;
  tribunal?: string | null;
  tipo?: string | null;
  fechaSentencia?: string | null;
  rit?: string | null;
  contenido: string;
  extracto?: string | null;
  score: number;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.min(Math.round(score * 10), 100);
  const variant = pct >= 70 ? "default" : pct >= 40 ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="text-[10px] shrink-0">
      {pct}% rel.
    </Badge>
  );
}

function NormativaCard({ doc }: { doc: SearchResult }) {
  return (
    <AccordionItem value={`doc-${doc.id}`} className="border rounded-lg mb-2 px-4">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-start gap-3 text-left w-full mr-2">
          <BookOpen className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                {doc.articulo || doc.titulo || "Norma"}
              </span>
              {doc.norma && (
                <Badge variant="outline" className="text-[10px]">
                  {doc.norma}
                </Badge>
              )}
              <ScoreBadge score={doc.score} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {doc.contenido.slice(0, 200)}...
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-neutral-800/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {doc.contenido}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function JurisprudenciaCard({ doc }: { doc: JurisResult }) {
  return (
    <AccordionItem value={`juris-${doc.id}`} className="border rounded-lg mb-2 px-4">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-start gap-3 text-left w-full mr-2">
          <Scale className="w-4 h-4 mt-0.5 shrink-0 text-violet-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                {doc.caratula || doc.rit || "Sentencia"}
              </span>
              {doc.rit && (
                <Badge variant="outline" className="text-[10px]">
                  {doc.rit}
                </Badge>
              )}
              <ScoreBadge score={doc.score} />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {doc.tribunal && (
                <span className="text-xs text-gray-500">{doc.tribunal}</span>
              )}
              {doc.fechaSentencia && (
                <span className="text-xs text-gray-400">{String(doc.fechaSentencia)}</span>
              )}
              {doc.tipo && (
                <Badge variant="secondary" className="text-[10px]">
                  {doc.tipo}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {(doc.extracto || doc.contenido).slice(0, 200)}...
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-50 dark:bg-neutral-800/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
          {doc.contenido}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function ConsultaLegal() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiFuentes, setAiFuentes] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const searchResults = trpc.rag.buscar.useQuery(
    { query: submittedQuery, limite: 10 },
    { enabled: submittedQuery.length > 0 }
  );

  const ragChat = trpc.rag.chat.useMutation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSubmittedQuery(query.trim());
    setAiAnswer("");
    setAiFuentes([]);
  };

  const handleAskAI = async () => {
    if (!submittedQuery) return;
    setIsAiLoading(true);
    setAiAnswer("");
    setAiFuentes([]);
    try {
      const result = await ragChat.mutateAsync({ mensaje: submittedQuery });
      setAiAnswer(result.respuesta);
      setAiFuentes(result.fuentes);
    } catch {
      setAiAnswer(
        "No se pudo obtener una respuesta del asistente. Intenta de nuevo."
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    setSubmittedQuery(s);
    setAiAnswer("");
    setAiFuentes([]);
  };

  const docs = (searchResults.data?.documentos ?? []) as SearchResult[];
  const juris = (searchResults.data?.jurisprudencia ?? []) as JurisResult[];
  const hasResults = docs.length > 0 || juris.length > 0;

  const sugerencias = [
    "Art. 162 despido injustificado",
    "Indemnización por años de servicio",
    "Ley Karin acoso laboral",
    "Feriado proporcional",
    "Jornada 40 horas",
    "Fuero maternal",
    "Subcontratación",
    "Despido indirecto art. 171",
  ];

  return (
    <div className="flex flex-col max-w-[960px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Consulta Legal
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Busca normativa y jurisprudencia laboral chilena con fuentes citadas
        </p>
      </div>

      {/* Search box */}
      <Card className="mb-6 border-gray-200 dark:border-neutral-800">
        <CardContent className="p-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por artículo, tema o palabra clave..."
                className="pl-10 h-12 text-base"
              />
            </div>
            <Button
              type="submit"
              disabled={!query.trim() || searchResults.isFetching}
              className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-base font-semibold"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </form>

          {!submittedQuery && (
            <div className="flex flex-wrap gap-2 mt-4">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSuggestion(s)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {searchResults.isFetching && (
        <div className="text-center py-12 text-gray-500">
          Buscando en la base normativa...
        </div>
      )}

      {/* Results */}
      {submittedQuery && !searchResults.isFetching && (
        <>
          {/* Ask AI button */}
          {hasResults && (
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {docs.length} documento(s) y {juris.length} fallo(s) encontrados
              </p>
              <Button
                onClick={handleAskAI}
                disabled={isAiLoading}
                variant="outline"
                className="border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isAiLoading ? "Analizando..." : "Sintetizar con IA"}
              </Button>
            </div>
          )}

          {/* AI Answer */}
          {(aiAnswer || isAiLoading) && (
            <Card className="mb-6 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    Respuesta IA
                  </span>
                </div>
                {isAiLoading ? (
                  <p className="text-sm text-gray-500">
                    Analizando normativa y generando respuesta...
                  </p>
                ) : (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{aiAnswer}</ReactMarkdown>
                    </div>
                    {aiFuentes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-violet-200 dark:border-violet-800">
                        <span className="text-xs font-semibold text-gray-500">
                          Fuentes:
                        </span>
                        {aiFuentes.map((f, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          {hasResults ? (
            <Tabs defaultValue="normativa">
              <TabsList className="mb-4">
                <TabsTrigger value="normativa" className="gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Normativa ({docs.length})
                </TabsTrigger>
                <TabsTrigger value="jurisprudencia" className="gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Jurisprudencia ({juris.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="normativa">
                {docs.length > 0 ? (
                  <Accordion type="single" collapsible>
                    {docs.map((doc) => (
                      <NormativaCard key={doc.id} doc={doc} />
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron documentos normativos para esta consulta.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="jurisprudencia">
                {juris.length > 0 ? (
                  <Accordion type="single" collapsible>
                    {juris.map((j) => (
                      <JurisprudenciaCard key={j.id} doc={j} />
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No se encontró jurisprudencia relevante para esta consulta.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="border-gray-200 dark:border-neutral-800">
              <CardContent className="py-12 text-center">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  No se encontraron resultados para &quot;{submittedQuery}&quot;
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Intenta con otros términos o consulta en{" "}
                  <a
                    href="https://www.leychile.cl"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    www.leychile.cl
                  </a>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!submittedQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <Card className="border-gray-200 dark:border-neutral-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group"
                onClick={() => handleSuggestion("Código del Trabajo")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  Código del Trabajo
                </p>
                <p className="text-xs text-gray-500">
                  Buscar artículos del DFL 1
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-neutral-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer group"
                onClick={() => handleSuggestion("jurisprudencia despido")}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  Jurisprudencia
                </p>
                <p className="text-xs text-gray-500">
                  Buscar fallos y sentencias
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
