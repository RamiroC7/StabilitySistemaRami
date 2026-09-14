import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Download, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useFeedbackData,
  FEEDBACK_PERIODS,
  type FeedbackPeriod,
} from "@/hooks/useFeedbackData";
import FeedbackCard from "./FeedbackCard";

// Duplicados a propósito: StudentProfile.tsx y CoachContactButton.tsx ya
// tienen su propia copia local de este mismo patrón (icono + formateo de
// teléfono), siguiendo la convención existente en el proyecto.
function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("54")) {
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    cleaned = "549" + cleaned;
  }
  return cleaned;
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

async function captureCardAsBlob(
  element: HTMLElement,
): Promise<Blob | null> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: 0,
  });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentPhone: string | null;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentPhone,
}: FeedbackModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<FeedbackPeriod>("week");
  const { data, loading } = useFeedbackData(studentId, period);
  const [isExporting, setIsExporting] = useState(false);

  const periodConfig = FEEDBACK_PERIODS.find((p) => p.key === period)!;
  const fileName = `feedback-${periodConfig.key}-${studentName
    .toLowerCase()
    .replace(/\s+/g, "-")}.png`;

  const handleDownload = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await captureCardAsBlob(cardRef.current);
      if (blob) downloadBlob(blob, fileName);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!cardRef.current || !studentPhone || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await captureCardAsBlob(cardRef.current);
      const firstName = studentName.split(" ")[0];
      const shareText = `¡Hola ${firstName}! Te comparto tu feedback de entrenamiento 💪`;

      // En mobile, si el navegador soporta compartir archivos, se adjunta
      // la imagen directamente en el share sheet (WhatsApp incluido).
      if (blob) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({ files: [file], text: shareText });
            return;
          } catch {
            // Usuario canceló el share o falló: seguimos con el fallback.
          }
        }
        // Fallback (desktop / navegadores sin Web Share API de archivos):
        // se descarga la imagen y se abre el chat para adjuntarla a mano,
        // ya que wa.me no permite adjuntar archivos por URL.
        downloadBlob(blob, fileName);
      }

      window.open(
        `https://wa.me/${formatPhoneForWhatsApp(studentPhone)}?text=${encodeURIComponent(shareText)}`,
        "_blank",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Feedback"
      description="Elegí el período y compartí el resumen con el alumno."
      size="md"
      className="max-h-[88vh] overflow-y-auto"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Selector de período */}
        <div className="w-full flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {FEEDBACK_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "flex-1 text-[11px] font-bold py-2 rounded-lg transition-colors",
                period === p.key
                  ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              {p.tabLabel}
            </button>
          ))}
        </div>

        {loading || !data ? (
          <div className="h-96 w-full flex items-center justify-center text-slate-400 text-sm">
            Cargando datos...
          </div>
        ) : (
          <>
            <div className="max-w-full overflow-x-auto rounded-2xl shadow-lg">
              <FeedbackCard ref={cardRef} studentName={studentName} data={data} />
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <Button
                onClick={handleDownload}
                disabled={isExporting}
                variant="outline"
                className="w-full h-11"
              >
                {isExporting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                Descargar como foto
              </Button>

              {studentPhone && (
                <button
                  onClick={handleSendWhatsApp}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 h-11 px-4 rounded-lg text-sm font-bold text-white text-center transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  style={{ background: "#25D366" }}
                >
                  {isExporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <WhatsAppIcon />
                  )}
                  Enviar por WhatsApp al alumno
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
