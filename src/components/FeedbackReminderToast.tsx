import { useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { getFeedbackReminders, getDebugNowOverride } from "@/hooks/useFeedbackData";

// Aviso chiquito arriba a la derecha ("hoy toca enviar feedback"), lunes
// todo el día o el día 1 de cada mes. A diferencia de un banner persistente,
// esto es un toast: aparece en CADA carga de página (no se recuerda que ya
// se cerró), se queda hasta que lo cierran a mano o navegan a otra ruta que
// desmonte este componente.
export function FeedbackReminderToast() {
  useEffect(() => {
    const reminders = getFeedbackReminders(getDebugNowOverride());
    if (reminders.length === 0) return;

    const id = toast.custom(
      (t) => (
        <div
          className="relative rounded-xl backdrop-blur-md px-5 py-3 shadow-lg w-full text-center animate-gentle-circle"
          style={{
            background:
              "linear-gradient(135deg, rgba(29,78,216,0.85) 0%, rgba(30,64,175,0.85) 100%)",
          }}
        >
          <button
            onClick={() => toast.dismiss(t)}
            className="absolute top-1.5 right-1.5 p-1 rounded-lg text-white/80 hover:bg-white/15 transition-colors"
            aria-label="Descartar recordatorio de feedback"
          >
            <X size={14} />
          </button>
          <p className="text-lg font-extrabold uppercase tracking-wide text-white leading-tight">
            Feedback
          </p>
          <p className="text-xs font-medium text-white/95 leading-tight mt-0.5 whitespace-pre-line">
            {reminders.map((r) => r.message).join(" · ")}
          </p>
        </div>
      ),
      { position: "top-right", duration: Infinity },
    );

    return () => toast.dismiss(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
