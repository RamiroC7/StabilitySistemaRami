import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";

const COACHES = [
  {
    name: "Juan",
    initial: "J",
    color: "bg-blue-500",
    wa: "https://wa.me/5493512240889?text=Hola%20Juan!%20Tengo%20una%20consulta%20durante%20mi%20entrenamiento%20%F0%9F%92%AA",
  },
  {
    name: "Agus",
    initial: "A",
    color: "bg-violet-500",
    wa: "https://wa.me/5493515743833?text=Hola%20Agus!%20Tengo%20una%20consulta%20durante%20mi%20entrenamiento%20%F0%9F%92%AA",
  },
];

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 14;
const DRAG_THRESHOLD = 6;

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function CoachContactButton() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const [y, setY] = useState(
    () => (typeof window !== "undefined" ? window.innerHeight : 800) - 140,
  );
  const [dragging, setDragging] = useState(false);

  const drag = useRef({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startY: 0,
  });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        active: true,
        moved: false,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startY: y,
      };
    },
    [y],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const dx = Math.abs(e.clientX - drag.current.startClientX);
    const dy = Math.abs(e.clientY - drag.current.startClientY);

    if (!drag.current.moved && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
      drag.current.moved = true;
      setDragging(true);
      setOpen(false);
    }

    if (drag.current.moved) {
      const delta = e.clientY - drag.current.startClientY;
      const maxY = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
      setY(Math.max(EDGE_MARGIN, Math.min(maxY, drag.current.startY + delta)));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;

    if (drag.current.moved) {
      setSide(e.clientX < window.innerWidth / 2 ? "left" : "right");
    } else {
      setOpen((v) => !v);
    }
    setDragging(false);
  }, []);

  // Popover opens toward screen center; flips vertically if near bottom
  const openAbove = y > window.innerHeight / 2;
  const popoverHorizontal = side === "right" ? "right-0" : "left-0";
  const popoverVertical = openAbove ? "bottom-[66px]" : "top-[66px]";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[48]" onClick={() => setOpen(false)} />
      )}

      <div
        style={{
          position: "fixed",
          top: y,
          ...(side === "right" ? { right: EDGE_MARGIN } : { left: EDGE_MARGIN }),
          zIndex: 49,
        }}
      >
        {/* Popover card */}
        {open && !dragging && (
          <div
            className={`absolute ${popoverHorizontal} ${popoverVertical} bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-56 p-3`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Hablar con tu profe
              </p>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {COACHES.map((coach) => (
                <a
                  key={coach.name}
                  href={coach.wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-[0.97] transition-all"
                >
                  <div
                    className={`w-8 h-8 rounded-full ${coach.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className="text-white text-sm font-bold">{coach.initial}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                      {coach.name}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      WhatsApp
                    </p>
                  </div>
                  <WhatsAppIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Floating button */}
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          aria-label="Contactar profe"
          style={{ touchAction: "none" }}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center select-none transition-colors ${
            dragging
              ? "cursor-grabbing bg-[#25D366] scale-110 shadow-xl"
              : open
                ? "cursor-pointer bg-slate-600 dark:bg-slate-500"
                : "cursor-grab bg-[#25D366] hover:bg-[#1ebe5d]"
          }`}
        >
          {open && !dragging ? (
            <X size={22} className="text-white pointer-events-none" />
          ) : (
            <WhatsAppIcon className="w-7 h-7 text-white pointer-events-none" />
          )}
        </button>
      </div>
    </>
  );
}
