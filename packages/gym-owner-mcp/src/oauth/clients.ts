/**
 * `gym_mcp.oauth_clients` — Dynamic Client Registration (T10, US-2/US-7,
 * design.md > Interfaces / contracts > `POST /register`).
 *
 * Clientes públicos (sin `client_secret`): el cliente MCP de Claude usa PKCE
 * (S256) para probar posesión del `code`, así que no hace falta un secreto de
 * cliente — `token_endpoint_auth_method: "none"` en toda respuesta/metadata
 * relacionada con estos clientes.
 */
import { randomBytes } from "node:crypto";
import { queryService } from "../db.js";

/** Error tipado para que el handler HTTP (`/register`) lo convierta en 400. */
export class InvalidRedirectUriError extends Error {
  readonly code = "invalid_redirect_uri" as const;

  constructor(uri: string) {
    super(`redirect_uri inválida (debe empezar con "https://" o "http://localhost"): ${uri}`);
    this.name = "InvalidRedirectUriError";
  }
}

export interface RegisterClientInput {
  redirect_uris: string[];
  client_name?: string;
}

export interface RegisteredClient {
  client_id: string;
  redirect_uris: string[];
  client_name: string | null;
  token_endpoint_auth_method: "none";
}

export interface OAuthClient {
  client_id: string;
  redirect_uris: string[];
  client_name: string | null;
}

/** `https://` siempre; `http://localhost` (cualquier puerto) solo para debugging local. */
function isAllowedRedirectUri(uri: string): boolean {
  if (uri.startsWith("https://")) return true;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "http:" && parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * Registra un cliente OAuth público nuevo (DCR). Valida CADA `redirect_uri`
 * antes de tocar la base — si alguna es inválida, tira `InvalidRedirectUriError`
 * sin insertar nada.
 */
export async function registerClient(input: RegisterClientInput): Promise<RegisteredClient> {
  if (input.redirect_uris.length === 0) {
    throw new InvalidRedirectUriError("(ninguna redirect_uri provista)");
  }
  for (const uri of input.redirect_uris) {
    if (!isAllowedRedirectUri(uri)) {
      throw new InvalidRedirectUriError(uri);
    }
  }

  const clientId = randomBytes(16).toString("hex");
  const clientName = input.client_name ?? null;

  await queryService(
    `insert into gym_mcp.oauth_clients (client_id, redirect_uris, client_name)
     values ($1, $2, $3)`,
    [clientId, input.redirect_uris, clientName],
  );

  return {
    client_id: clientId,
    redirect_uris: input.redirect_uris,
    client_name: clientName,
    token_endpoint_auth_method: "none",
  };
}

interface OAuthClientRow {
  client_id: string;
  redirect_uris: string[];
  client_name: string | null;
}

/** Usado por `/authorize` y `/token` para validar `client_id`/`redirect_uri`. */
export async function findClient(clientId: string): Promise<OAuthClient | null> {
  const rows = await queryService<OAuthClientRow>(
    `select client_id, redirect_uris, client_name
     from gym_mcp.oauth_clients
     where client_id = $1`,
    [clientId],
  );
  return rows[0] ?? null;
}
