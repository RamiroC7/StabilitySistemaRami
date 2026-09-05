import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sendChatMessage, type ChatMessage } from "@/lib/aiChat";
import { MarkdownLite } from "@/features/assistant/MarkdownLite";

const SUGGESTED_PROMPTS = [
  "¿Cuántos alumnos activos tengo?",
  "¿Qué planes están por vencer esta semana?",
  "¿Cuáles fueron los últimos entrenamientos completados?",
];

export default function AdminChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const reply = await sendChatMessage(nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b bg-white/95 dark:bg-slate-900/95 px-4 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary" size={22} />
          <h1 className="text-lg font-bold">Asistente de datos</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Preguntale en lenguaje natural sobre tus alumnos, planes y entrenamientos.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 pt-4">
            <p className="text-sm text-muted-foreground mb-1">Probá preguntando, por ejemplo:</p>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="text-left text-sm rounded-lg border border-input bg-background px-4 py-3 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                message.role === "user"
                  ? "whitespace-pre-wrap bg-primary text-white rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm"
              )}
            >
              {message.role === "assistant" ? (
                <MarkdownLite content={message.content} />
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
              <Loader2 size={14} className="animate-spin" />
              Consultando la base de datos...
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-white/95 dark:bg-slate-900/95 px-4 py-3 md:px-6">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu pregunta..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label="Enviar pregunta"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
