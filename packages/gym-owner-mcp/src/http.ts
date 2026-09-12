/**
 * Entrypoint del transport HTTP (T8, Fase B) — Streamable HTTP stateless con
 * la API HTTP real de `@modelcontextprotocol/server` v2.0.0 (`createMcpHandler`,
 * un handler web-standard `{ fetch, close }`). Mismo patrón de conversión
 * Node↔web-standard que `packages/mcp-server/src/http.ts` (`toWebRequest`/
 * `sendWebResponse` con `stream.Readable.toWeb`/`fromWeb`, Node core, sin
 * dependencia nueva) — NO se toca ese paquete, esto es una copia adaptada acá.
 *
 * Diferencia clave con el sibling (`packages/mcp-server/src/http.ts`): ese
 * archivo resuelve auth por request (Bearer token contra `mcp.access_tokens`)
 * porque ya tiene Fase 4 (auth) hecha. Acá **todavía no existe auth** — eso es
 * T15 (Fase C), no se adelanta nada de eso en este archivo. Por eso NO hay
 * `bearerTokenFrom`/`resolveToken`/`UNAUTHORIZED_MESSAGE`: no aplican todavía.
 *
 * Protección DNS-rebinding (host/origin) con los helpers reales de la SDK
 * (`hostHeaderValidationResponse`/`originValidationResponse`) SÍ se deja
 * puesta desde ya, igual que el sibling: es independiente de si hay auth de
 * coach o no, y dejarla es gratis y buena práctica.
 */
import "./load-env.js";
import http from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
} from "@modelcontextprotocol/server";
import { createServer } from "./create-server.js";
import { closePools } from "./db.js";
import type { CoachIdentity } from "./types.js";

/**
 * T15 va a reemplazar esto por la identidad real resuelta por request; hasta
 * entonces todo tool call de este endpoint HTTP se audita con este profile_id
 * placeholder.
 */
const DEV_IDENTITY: CoachIdentity = {
  profileId: "00000000-0000-0000-0000-000000000000",
  label: "dev (sin OAuth todavía, ver T15)",
};

const PORT = Number(process.env.GYM_OWNER_MCP_HTTP_PORT ?? 8788);

const allowedHostnames = [...localhostAllowedHostnames()];
const allowedOrigins = [...localhostAllowedOrigins()];

/** Convierte un `IncomingMessage` de Node a un `Request` web-standard. */
function toWebRequest(req: http.IncomingMessage): Request {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    // `duplex: "half"` es requerido por fetch() cuando el body es un stream.
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    duplex: hasBody ? "half" : undefined,
  } as RequestInit);
}

/** Escribe un `Response` web-standard en un `ServerResponse` de Node. */
async function sendWebResponse(response: Response, res: http.ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  if (!response.body) {
    res.end();
    return;
  }

  await new Promise<void>((resolvePromise, reject) => {
    const nodeStream = Readable.fromWeb(response.body as unknown as NodeWebReadableStream);
    nodeStream.pipe(res);
    nodeStream.on("error", reject);
    res.on("finish", () => resolvePromise());
  });
}

// Una sola instancia de `createMcpHandler`, reutilizada en todos los requests
// (el `pg.Pool` de `db.ts` vive a nivel de módulo, no por request). Sin auth
// todavía: la factory siempre construye el server con `DEV_IDENTITY`.
const mcpHandler = createMcpHandler(() => createServer(DEV_IDENTITY), {
  legacy: "stateless",
  onerror: (err) => console.error("[http] error interno del handler MCP:", err.message),
});

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const request = toWebRequest(req);

  const hostRejection = hostHeaderValidationResponse(request, allowedHostnames);
  if (hostRejection) return sendWebResponse(hostRejection, res);
  const originRejection = originValidationResponse(request, allowedOrigins);
  if (originRejection) return sendWebResponse(originRejection, res);

  const url = new URL(request.url);
  if (url.pathname !== "/mcp") {
    res.statusCode = 404;
    res.end();
    return;
  }

  const response = await mcpHandler.fetch(request, {});
  await sendWebResponse(response, res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error("[http] error no manejado:", err instanceof Error ? err.message : String(err));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Error interno." }));
    } else {
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.error(
    `[gym-owner-mcp] servidor MCP HTTP escuchando en http://localhost:${PORT}/mcp (sin auth todavía — ver T15)`,
  );
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[gym-owner-mcp] ${signal} recibido, cerrando…`);
  try {
    await mcpHandler.close();
    await closePools();
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  } catch (err) {
    console.error("[gym-owner-mcp] error durante el shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
