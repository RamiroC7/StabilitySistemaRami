import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatDateLocal(dateStr: string | null | undefined): string {
    if (!dateStr) return "—";
    
    // Si contiene 'T', es un timestamp completo
    if (dateStr.includes('T')) {
        return new Date(dateStr).toLocaleDateString("es-AR");
    }
    
    // Si es solo YYYY-MM-DD, parseamos manualmente para evitar desfase de zona horaria
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-AR");
}
