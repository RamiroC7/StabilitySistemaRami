import type { ReactNode } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const FIELD_LABEL =
  "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1";
export const FIELD_INPUT =
  "block w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none";
export const FIELD_SELECT =
  "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none";

interface ProfileCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  isComplete: boolean;
  isExpanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Tarjeta colapsable con el encabezado común de cada sección del perfil. */
export function ProfileCard({
  icon: Icon,
  title,
  subtitle,
  isComplete,
  isExpanded,
  disabled,
  onToggle,
  children,
}: ProfileCardProps) {
  return (
    <div className="bg-white dark:bg-surface-dark/50 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full flex items-center p-4 hover:bg-gray-50 dark:hover:bg-surface-dark transition-all duration-200"
        disabled={disabled}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mr-4 shrink-0 transition-transform duration-200 group-hover:scale-105">
          <Icon size={24} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-base font-semibold text-[#101418] dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <CheckCircle2
              size={18}
              className="text-green-500 animate-in fade-in duration-300"
            />
          )}
          <ChevronDown
            size={20}
            className={cn(
              "text-gray-400 transition-transform duration-300",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-300">
          {children}
        </div>
      )}
    </div>
  );
}

/** Botones Guardar / Cancelar del modo edición. */
export function EditActions({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={() => onSave()}
        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all"
      >
        Actualizar Datos
      </button>
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
      >
        Cancelar
      </button>
    </div>
  );
}

/** Dato de solo lectura (icono + etiqueta + valor) de la sección personal. */
export function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
