import { useState, useEffect } from "react";

// La spec del evento BeforeInstallPromptEvent no está en los tipos estándar de TS/DOM,
// así que la declaramos localmente para tener tipado completo.
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
}

interface UsePWAInstallReturn {
    isInstallable: boolean;
    installPWA: () => Promise<void>;
}

export function usePWAInstall(): UsePWAInstallReturn {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            // Previene que el navegador muestre el mini-infobar automático
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Si la app ya fue instalada, limpiamos el estado
        const installedHandler = () => setDeferredPrompt(null);
        window.addEventListener("appinstalled", installedHandler);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
            window.removeEventListener("appinstalled", installedHandler);
        };
    }, []);

    const installPWA = async () => {
        if (!deferredPrompt) return;

        // Dispara el diálogo nativo de instalación del OS/navegador
        await deferredPrompt.prompt();

        // Esperamos la decisión del usuario; después, limpiamos siempre el evento
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
    };

    return {
        isInstallable: deferredPrompt !== null,
        installPWA,
    };
}
