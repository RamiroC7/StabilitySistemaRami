import { useRouteError } from "react-router-dom";
import { WifiOff } from "lucide-react";
import * as Sentry from "@sentry/react";

export function GlobalError() {
  const error = useRouteError();

  // Log the error for debugging purposes
  console.error("[GlobalError]", error);
  // Y reportarlo a Sentry — en produccion el console.error de arriba se
  // elimina del build (esbuild.drop), asi que sin esto el error no queda
  // registrado en ningun lado.
  Sentry.captureException(error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-center">
      <WifiOff size={64} className="mb-6 text-red-400" strokeWidth={1.5} />

      <h1 className="mb-2 text-2xl font-bold text-white">
        Hubo un problema de conexión
      </h1>

      <p className="mb-8 max-w-sm text-base text-gray-400">
        No se pudo cargar parte de la aplicación. Esto suele ocurrir cuando se
        pierde la conexión o el caché está desactualizado.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-primary px-8 py-3 text-base font-semibold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-75"
      >
        Recargar App
      </button>
    </div>
  );
}
