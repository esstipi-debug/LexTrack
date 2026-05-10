import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, BookOpen, Scale, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  fuentes?: string[];
}

export default function Asistente() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hola! Soy **LexTrack AI**, tu asistente legal especializado en derecho laboral chileno. Puedo consultar el Código del Trabajo, jurisprudencia, calcular indemnizaciones y más.\n\n**Ejemplos de consultas:**\n- \"Artículo 163 del código del trabajo\"\n- \"¿Cuánto corresponde de indemnización por 5 años?\"\n- \"Despido indirecto, ¿qué dice la ley?\"\n- \"Ley Karin, medidas de prevención\"\n- \"Busca jurisprudencia sobre desconexión digital\"" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const ragChat = trpc.rag.chat.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const result = await ragChat.mutateAsync({ mensaje: userMsg, sessionId: "session-1" });
      setMessages(prev => [...prev, { role: "assistant", content: result.respuesta, fuentes: result.fuentes }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, ocurrió un error al procesar tu consulta. Intenta de nuevo." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sugerencias = [
    "Artículo 163 indemnización",
    "Desconexión digital",
    "Ley Karin denuncias",
    "Vacaciones proporcionales",
    "Aviso previo 30 días",
    "Despido indirecto",
  ];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Asistente Legal RAG</h1>
        <p className="text-gray-500 dark:text-gray-400">Consulta normativa laboral chilena, jurisprudencia y cálculos</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  }`}>
                    <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                      {msg.content}
                    </ReactMarkdown>
                    {msg.fuentes && msg.fuentes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Fuentes:
                        </p>
                        {msg.fuentes.map((f, j) => (
                          <span key={j} className="inline-block mt-1 mr-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  </div>
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-500">Consultando base normativa...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Consulta sobre derecho laboral chileno..."
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
