import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Le manda la conversación al asistente de IA del panel de administrador
 * (endpoint /api/ai-chat) y devuelve la respuesta en texto.
 *
 * El endpoint usa el token de la sesión actual para respetar los mismos
 * permisos (RLS) que ya tiene el usuario logueado, y solo puede leer datos.
 */
export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("No se encontró tu sesión. Volvé a iniciar sesión e intentá de nuevo.");
  }

  const response = await fetch("/api/ai-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages }),
  });

  let data: { reply?: string; error?: string } = {};
  try {
    data = await response.json();
  } catch {
    // respuesta no-JSON (por ejemplo un error 500 sin body) — se maneja abajo
  }

  if (!response.ok) {
    throw new Error(data.error || "Ocurrió un error al consultar el asistente.");
  }

  return data.reply || "";
}
