import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export default function LogoutBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: LogoutBottomSheetProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[101] transform transition-all duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl border-t border-slate-200 dark:border-slate-800 max-w-lg mx-auto">
          {/* Handle/Drag indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Content */}
          <div className="px-6 pt-4 pb-8">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              disabled={isLoading}
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <LogOut className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                ¿Cerrar Sesión?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Estás a punto de cerrar tu sesión. Tendrás que volver a iniciar sesión para acceder a tu cuenta.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white transition-all shadow-lg active:scale-[0.98]",
                  "bg-red-600 hover:bg-red-700 shadow-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Cerrando sesión...
                  </>
                ) : (
                  <>
                    <LogOut size={20} />
                    Sí, cerrar sesión
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className={cn(
                  "w-full inline-flex justify-center rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3.5 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
