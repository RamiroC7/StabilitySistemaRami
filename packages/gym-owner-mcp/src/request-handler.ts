/**
 * Lógica de ruteo HTTP del server MCP del gym-owner (T8 Fase B, T15 Fase C;
 * separado de `http.ts` para T17 — deploy en Vercel). Todo lo que convierte
 * un `http.IncomingMessage`/`ServerResponse` de Node en objetos
 * web-standard (`Request`/`Response`) y resuelve las rutas de OAuth + `/mcp`
 * vive acá, en `handleRequest`, para que dos entrypoints distintos lo
 * reusen sin duplicar lógica:
 *   - `http.ts`: bootstrap `node:http` local (`npm run dev:http`, T8-T9).
 *   - `../api/handler.ts`: Vercel Node.js Serverless Function (T17) — Vercel
 *     invoca funciones con la misma firma `(req, res)` de `node:http`, así
 *     que el mismo `handleRequest` sirve para los dos sin cambios.
 *
 * Mismo patrón de conversión Node↔web-standard que el sibling
 * `packages/mcp-server/src/http.ts` (`toWebRequest`/`sendWebResponse` con
 * `stream.Readable.toWeb`/`fromWeb`, Node core, sin dependencia nueva).
 *
 * T15 (Fase C) reemplaza el `DEV_IDENTITY` hardcodeado de T8 por auth real:
 * cada request a `/mcp` extrae `Authorization: Bearer <token>`, lo resuelve
 * contra `gym_mcp.access_tokens` (`resolveBearerToken`), y si no resuelve a
 * un coach responde 401 opaco SIN construir el server ni ejecutar ninguna
 * tool call — mismo criterio fail-closed que US-2. Este archivo también
 * cablea las rutas del Authorization Server propio (T10-T14): `POST
 * /register`, los dos endpoints de metadata (`/.well-known/...`), `GET
 * /authorize`, `POST /authorize/callback` y `POST /token` — esas rutas NO
 * llevan el chequeo de Bearer de `/mcp` (son del Authorization Server, no del
 * Resource Server).
 *
 * Protección DNS-rebinding (host/origin) con los helpers reales de la SDK
 * (`hostHeaderValidationResponse`/`originValidationResponse`), igual que en
 * T8: independiente de la auth de coach, se deja puesta para todas las rutas.
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
import type { CoachIdentity } from "./types.js";
import { InvalidRedirectUriError, findClient, registerClient } from "./oauth/clients.js";
import { buildAuthServerMetadata, buildProtectedResourceMetadata } from "./oauth/metadata.js";
import { renderAuthorizePage } from "./oauth/authorize-page.js";
import { authorizeCallback } from "./oauth/authorize-callback.js";
import { exchangeAuthorizationCode, refreshAccessToken } from "./oauth/token.js";
import { resolveBearerToken } from "./oauth/resolve-bearer.js";

/** Sólo se usa como fallback de `toWebRequest` cuando no viene `Host` (no debería pasar en Vercel real). */
export const PORT = Number(process.env.GYM_OWNER_MCP_HTTP_PORT ?? 8788);

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/** `Authorization: Bearer <token>` -> `<token>`, o `null` si no viene en ese formato. */
function bearerTokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Protocolo+host de la request REAL, no hardcodeado — con
 * `x-forwarded-proto`/`x-forwarded-host` (Vercel está detrás de un proxy que
 * termina TLS) como fuente de verdad cuando están presentes; si no, cae al
 * protocolo/host que ya resolvió `toWebRequest` (en local, `localhost:<GYM_OWNER_MCP_HTTP_PORT>`).
 */
function issuerFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0]?.trim() : url.protocol.replace(":", "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? url.host;
  return `${protocol}://${host}`;
}

function requireSupabaseEnv(): { supabaseUrl: string; supabaseAnonKey: string } | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}

async function handleRegister(request: Request): Promise<Response> {
  let body: { redirect_uris?: unknown; client_name?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.every((uri) => typeof uri === "string")) {
    return jsonResponse({ error: "invalid_redirect_uri" }, 400);
  }

  try {
    const client = await registerClient({
      redirect_uris: body.redirect_uris,
      client_name: typeof body.client_name === "string" ? body.client_name : undefined,
    });
    return jsonResponse(client, 201);
  } catch (err) {
    if (err instanceof InvalidRedirectUriError) {
      return jsonResponse({ error: "invalid_redirect_uri" }, 400);
    }
    console.error("[http] error en /register:", err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: "server_error" }, 500);
  }
}

/**
 * `GET /authorize`: valida `client_id`/`redirect_uri` contra `oauth_clients`
 * ANTES de renderizar el form — si no matchean, 400 sin mostrar nada (T12).
 */
async function handleAuthorize(url: URL): Promise<Response> {
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const state = url.searchParams.get("state") ?? "";

  const client = await findClient(clientId).catch((err: unknown) => {
    console.error("[http] error buscando client_id en /authorize:", err instanceof Error ? err.message : String(err));
    return null;
  });
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return jsonResponse({ error: "invalid_client" }, 400);
  }

  const supabaseEnv = requireSupabaseEnv();
  if (!supabaseEnv) {
    console.error("[http] Falta SUPABASE_URL o SUPABASE_ANON_KEY: no se puede renderizar /authorize.");
    return jsonResponse({ error: "server_error" }, 500);
  }

  const html = renderAuthorizePage({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state,
    supabaseUrl: supabaseEnv.supabaseUrl,
    supabaseAnonKey: supabaseEnv.supabaseAnonKey,
  });
  return htmlResponse(html);
}

/** `POST /authorize/callback`: responde `{ redirect_to }` como JSON (NO un 302 real, ver T12/T13). */
async function handleAuthorizeCallbackRoute(request: Request): Promise<Response> {
  let body: {
    supabase_access_token?: unknown;
    client_id?: unknown;
    redirect_uri?: unknown;
    code_challenge?: unknown;
    state?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  if (
    typeof body.supabase_access_token !== "string" ||
    typeof body.client_id !== "string" ||
    typeof body.redirect_uri !== "string" ||
    typeof body.code_challenge !== "string" ||
    typeof body.state !== "string"
  ) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const result = await authorizeCallback({
    supabaseAccessToken: body.supabase_access_token,
    clientId: body.client_id,
    redirectUri: body.redirect_uri,
    codeChallenge: body.code_challenge,
    state: body.state,
  });

  if ("error" in result) {
    return jsonResponse({ error: result.error }, result.status);
  }
  return jsonResponse({ redirect_to: result.redirectTo });
}

/** Body de `/token`: soporta tanto `application/x-www-form-urlencoded` (RFC 6749) como JSON. */
async function parseBodyParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  const text = await request.text();
  const out: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") out[key] = value;
      }
    } catch {
      // body inválido: se devuelve out vacío, el caller lo trata como
      // parámetros faltantes (invalid_grant/unsupported_grant_type).
    }
    return out;
  }

  for (const [key, value] of new URLSearchParams(text)) {
    out[key] = value;
  }
  return out;
}

async function handleToken(request: Request): Promise<Response> {
  const body = await parseBodyParams(request);

  if (body.grant_type === "authorization_code") {
    const result = await exchangeAuthorizationCode({
      code: body.code ?? "",
      codeVerifier: body.code_verifier ?? "",
      clientId: body.client_id ?? "",
      redirectUri: body.redirect_uri ?? "",
    });
    return jsonResponse(result, "error" in result ? 400 : 200);
  }

  if (body.grant_type === "refresh_token") {
    const result = await refreshAccessToken({
      refreshToken: body.refresh_token ?? "",
      clientId: body.client_id ?? "",
    });
    return jsonResponse(result, "error" in result ? 400 : 200);
  }

  return jsonResponse({ error: "unsupported_grant_type" }, 400);
}

// Una sola instancia de `createMcpHandler`, reutilizada en todos los requests
// (el `pg.Pool` de `db.ts` vive a nivel de módulo, no por request). La
// factory recibe la identidad YA resuelta por `handleRequest` vía
// `ctx.authInfo.extra` (mismo patrón que `packages/mcp-server/src/http.ts`).
//
// Se exporta para que el bootstrap local (`http.ts`) pueda llamar
// `mcpHandler.close()` durante el shutdown por SIGINT/SIGTERM. En Vercel
// (funciones serverless sin proceso long-lived) nadie llama `close()`.
export const mcpHandler = createMcpHandler(
  (ctx) => {
    const extra = ctx.authInfo?.extra as Partial<CoachIdentity> | undefined;
    const identity: CoachIdentity = {
      profileId: extra?.profileId ?? "",
      label: extra?.label ?? "",
    };
    return createServer(identity);
  },
  {
    legacy: "stateless",
    onerror: (err) => console.error("[http] error interno del handler MCP:", err.message),
  },
);

async function handleMcpRoute(request: Request, res: http.ServerResponse): Promise<void> {
  // US-2/US-3, fail-closed: sin token válido, ni se construye el server ni
  // se llega a ejecutar ninguna tool call.
  const identity = await resolveBearerToken(bearerTokenFrom(request) ?? "").catch((err: unknown) => {
    console.error("[http] error resolviendo el bearer token:", err instanceof Error ? err.message : String(err));
    return null;
  });
  if (!identity) {
    return sendWebResponse(jsonResponse({ error: "No autorizado." }, 401), res);
  }

  const authInfo: AuthInfo = {
    // El token en claro no se re-expone: nuestra verificación ya pasó, pero
    // el campo es obligatorio en el tipo `AuthInfo` de la SDK.
    token: "***",
    clientId: identity.profileId,
    scopes: ["coach"],
    extra: { profileId: identity.profileId, label: identity.label },
  };

  const response = await mcpHandler.fetch(request, { authInfo });
  await sendWebResponse(response, res);
}

/**
 * Maneja un request HTTP completo: valida host/origin, rutea OAuth + `/mcp`,
 * y escribe la respuesta en `res`. Firma `(req, res)` de `node:http` —
 * compatible con Vercel Node.js Serverless Functions sin adaptar nada.
 */
export async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const request = toWebRequest(req);

  const hostRejection = hostHeaderValidationResponse(request, allowedHostnames);
  if (hostRejection) return sendWebResponse(hostRejection, res);
  const originRejection = originValidationResponse(request, allowedOrigins);
  if (originRejection) return sendWebResponse(originRejection, res);

  const url = new URL(request.url);
  const issuer = issuerFromRequest(request);

  // Rutas del Authorization Server (T10-T14): SIN el chequeo de Bearer de
  // abajo — son públicas por naturaleza (DCR, metadata, login, intercambio
  // de código), no del Resource Server `/mcp`.
  if (request.method === "GET" && url.pathname === "/.well-known/oauth-authorization-server") {
    return sendWebResponse(jsonResponse(buildAuthServerMetadata(issuer)), res);
  }
  if (request.method === "GET" && url.pathname === "/.well-known/oauth-protected-resource") {
    return sendWebResponse(jsonResponse(buildProtectedResourceMetadata(issuer)), res);
  }
  if (request.method === "POST" && url.pathname === "/register") {
    return sendWebResponse(await handleRegister(request), res);
  }
  if (request.method === "GET" && url.pathname === "/authorize") {
    return sendWebResponse(await handleAuthorize(url), res);
  }
  if (request.method === "POST" && url.pathname === "/authorize/callback") {
    return sendWebResponse(await handleAuthorizeCallbackRoute(request), res);
  }
  if (request.method === "POST" && url.pathname === "/token") {
    return sendWebResponse(await handleToken(request), res);
  }

  if (url.pathname !== "/mcp") {
    res.statusCode = 404;
    res.end();
    return;
  }

  await handleMcpRoute(request, res);
}
