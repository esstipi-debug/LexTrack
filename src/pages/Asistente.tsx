import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  fuentes?: string[];
}

export default function Asistente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hola. Puedo ayudarte con consultas sobre el Código del Trabajo, leyes laborales especiales y jurisprudencia chilena. Todas mis respuestas incluyen fuentes citadas.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const ragChat = trpc.rag.chat.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const result = await ragChat.mutateAsync({ mensaje: userMsg, sessionId: "session-1" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.respuesta, fuentes: result.fuentes },
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
    "Despido indirecto",
    "Ley Karin",
    "Vacaciones proporcionales",
    "Aviso previo",
    "Horas extra",
  ];

  return (
    <div className="flex flex-col max-w-[900px] mx-auto h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Preguntar
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Código del Trabajo, leyes especiales y jurisprudencia
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden border-gray-200 dark:border-neutral-800">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-5 py-5">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i}>
                  <div
                    className={`max-w-[85%] px-4 py-3.5 rounded-xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "ml-auto bg-blue-50 dark:bg-blue-950/40 text-gray-900 dark:text-gray-100"
                        : "bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                  {msg.fuentes && msg.fuentes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 max-w-[85%]">
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
              ))}
              {isLoading && (
                <div className="max-w-[85%] px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-neutral-800 text-sm text-gray-500">
                  Consultando normativa…
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
