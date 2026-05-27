import { useState, useRef, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  fuentes?: string[];
  herramientasUsadas?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  buscar_normativa: "Normativa",
  buscar_jurisprudencia: "Jurisprudencia",
  listar_causas: "Causas",
  listar_tareas: "Tareas",
  crear_tarea: "Crear tarea",
  listar_alertas: "Alertas",
  plazos_vencidos: "Plazos",
  calcular_indemnizacion: "Indemnización",
  estadisticas: "Estadísticas",
  estado_cobranza: "Cobranza",
  estado_leykarin: "Ley Karin",
  diario_oficial: "Diario Oficial",
  generar_documento: "Documento",
  calcular_plazos: "Plazos legales",
  analizar_causa: "Análisis causa",
};

export default function Asistente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola. Soy **LexTrack AI**, tu agente legal asistente. Puedo buscar normativa, jurisprudencia, gestionar causas y tareas, calcular indemnizaciones, y más. Escribe tu consulta.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const agentChat = trpc.agent.chat.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    trackEvent('agent_message_sent');

    try {
      const historial = newMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await agentChat.mutateAsync({
        mensaje: userMsg,
        historial: historial.slice(0, -1),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.respuesta,
          fuentes: result.fuentes,
          herramientasUsadas: result.herramientasUsadas,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Ocurrió un error al procesar tu consulta. Intenta de nuevo.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sugerencias = [
    "Art. 163 indemnización",
    "Genera carta de despido",
    "Plazo para recurso de nulidad",
    "Analiza mi causa más reciente",
    "Calcula indemnización 5 años, sueldo 800.000",
    "Genera demanda de despido injustificado",
  ];

  return (
    <div className="flex flex-col max-w-[900px] mx-auto h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Asistente Legal
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Agente con acceso a normativa, jurisprudencia y datos del estudio
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 dark:border-neutral-800">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-5 py-5" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 mt-1 w-7 h-7 rounded-full flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-blue-100 dark:bg-blue-900/40"
                        : "bg-emerald-100 dark:bg-emerald-900/40"
                    }`}>
                      {msg.role === "user" ? (
                        <User className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`px-4 py-3.5 rounded-xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-50 dark:bg-blue-950/40 text-gray-900 dark:text-gray-100"
                            : "bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>

                      {msg.herramientasUsadas && msg.herramientasUsadas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Wrench className="w-3 h-3 text-gray-400" />
                          {msg.herramientasUsadas.map((t, j) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium">
                              {TOOL_LABELS[t] || t}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {msg.fuentes && msg.fuentes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs font-semibold text-gray-500">Fuentes:</span>
                          {msg.fuentes.map((f, j) => (
                            <span
                              key={j}
                              className="px-2.5 py-1 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-1 w-7 h-7 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/40">
                    <Bot className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 animate-pulse" />
                  </div>
                  <div className="px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-neutral-800 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="animate-pulse">Analizando consulta y ejecutando herramientas</span>
                      <span className="flex gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-gray-200 dark:border-neutral-800 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {sugerencias.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="px-3.5 py-1.5 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta legal…"
                className="flex-1 h-11"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="h-11 px-4 bg-blue-600 hover:bg-blue-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
