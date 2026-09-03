/**
 * Entrypoint del transport HTTP (Fase 6 / T16) — **escrito ahora, NO desplegado
 * en esta fase** (design.md D-1: "una definicion, dos transports"). Nadie lo
 * importa desde `stdio.ts` ni desde ningun script de `package.json`; se deja
 * listo para cuando exista un BFF/cron que necesite pegarle por HTTP.
 *
 * Usa la API HTTP real de `@modelcontextprotocol/server` v2.0.0
 * (`createMcpHandler`, un handler web-standard `{ fetch, close }`) — NO el
 * paquete `@modelcontextprotocol/express` que mencionaba el sketch original
 * de `design.md`: ese paquete no esta instalado (ni es una dependencia del
 * proyecto), y la app real *no* necesita Express — `createMcpHandler` ya
 * expone un `fetch(request)` web-standard. Este archivo lo monta a mano
 * sobre `node:http` (sin Express, sin dependencias nuevas), convirtiendo
 * `IncomingMessage`/`ServerResponse` de Node a `Request`/`Response`
 * web-standard con `stream.Readable.toWeb`/`fromWeb` (Node core, sin dep).
 *
 * Auth por header (US-7, design.md > Interfaces > Autenticacion, caso HTTP):
 * se lee `Authorization: Bearer <token>` UNA vez por request, se resuelve con
 * el mismo `resolveToken` que usa stdio, y si no resuelve a un coach se
 * responde 401 con el mismo `UNAUTHORIZED_MESSAGE` opaco — sin usar el
 * `requireBearerAuth`/`verifyBearerToken` de la SDK (esos son para el flujo
 * OAuth de terceros, con su propio formato de error `invalid_token` /
 * `WWW-Authenticate`; nuestro modelo es un token personal contra
 * `mcp.access_tokens`, no OAuth, y US-7 pide un unico mensaje opaco, no el
 * detalle que expone el flujo OAuth). La identidad ya resuelta se pasa a
 * `createServer(auth)` via `ctx.authInfo.extra` (ver `create-server.ts`), asi
 * que cada tool call NO vuelve a pegarle a la base para re-resolver el token
 * (a diferencia de stdio, donde cada llamada s vuelve a resolver
 * `MCP_ACCESS_TOKEN` desde el entorno — ahi no hay "por request" que ahorrar).
 *
 * Proteccion DNS-rebinding (host/origin) con los helpers reales de la SDK:
 * `hostHeaderValidationResponse` / `originValidationResponse`. En local,
 * `localhost*`; `MCP_HOST` (env) se suma al allowlist para un deploy futuro.
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
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { createServer } from "./create-server.js";
import { resolveToken, UNAUTHORIZED_MESSAGE, type ResolvedAuth } from "./auth.js";
import { closePool } from "./db.js";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 8787);

// `MCP_HOST` (ver .env.example) se suma al allowlist de localhost para un
// deploy futuro detras de un dominio propio. Sin `MCP_HOST`, solo localhost.
const extraHost = process.env.MCP_HOST && process.env.MCP_HOST !== "localhost" ? [process.env.MCP_HOST] : [];
const allowedHostnames = [...localhostAllowedHostnames(), ...extraHost];
const allowedOrigins = [...localhostAllowedOrigins(), ...extraHost];

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

function sendOpaqueError(res: http.ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: message }));
}

/** `Authorization: Bearer <token>` -> `<token>`, o `null` si no viene en ese formato. */
function bearerTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

// Una sola instancia de `createMcpHandler`, reutilizada en todos los
// requests (design.md > "Una definicion, dos transports" — el `pg.Pool` de
// `db.ts` vive a nivel de modulo, no por request). La factory recibe la
// identidad YA resuelta por `handleRequest` via `ctx.authInfo.extra`.
const mcpHandler = createMcpHandler(
  (ctx) => {
    const extra = ctx.authInfo?.extra as Partial<ResolvedAuth> | undefined;
    const auth: ResolvedAuth | undefined =
      extra?.profileId && extra?.coachName
        ? { profileId: extra.profileId, coachName: extra.coachName }
        : undefined;
    return createServer(auth);
  },
  {
    legacy: "stateless",
    onerror: (err) => console.error("[http] error interno del handler MCP:", err.message),
  },
);

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

  // US-7: un unico mensaje opaco ante cualquier motivo de rechazo — mismo
  // criterio que stdio (`assertAuthFromEnv`) y que el guard de cada tool call
  // (`guardToolDispatch`), NO el formato de error de OAuth de la SDK.
  const auth = await resolveToken(bearerTokenFrom(request) ?? "").catch((err: unknown) => {
    console.error("[http] error validando token:", err instanceof Error ? err.message : String(err));
    return null;
  });
  if (!auth) {
    sendOpaqueError(res, 401, UNAUTHORIZED_MESSAGE);
    return;
  }

  const authInfo: AuthInfo = {
    // El token en claro no se re-expone: `createMcpHandler` no lo usa para
    // nada propio (nuestra verificacion ya paso), pero el campo es
    // obligatorio en el tipo `AuthInfo` de la SDK.
    token: "***",
    clientId: auth.profileId,
    scopes: ["coach"],
    extra: { profileId: auth.profileId, coachName: auth.coachName },
  };

  const response = await mcpHandler.fetch(request, { authInfo });
  await sendWebResponse(response, res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error("[http] error no manejado:", err instanceof Error ? err.message : String(err));
    if (!res.headersSent) sendOpaqueError(res, 500, "Error interno.");
    else res.end();
  });
});

server.listen(PORT, () => {
  console.error(`[stability-db] servidor MCP HTTP escuchando en http://localhost:${PORT}/mcp (NO desplegado — ver README > Operacion)`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[stability-db] ${signal} recibido, cerrando…`);
  try {
    await mcpHandler.close();
    await closePool();
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  } catch (err) {
    console.error("[stability-db] error durante el shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
