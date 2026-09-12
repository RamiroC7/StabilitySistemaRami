/**
 * `POST /token` — intercambio de `code` por tokens y refresh (T14, US-2,
 * design.md > Interfaces / contracts > `POST /token`).
 *
 * Dos flujos (`grant_type`):
 *  - `authorization_code`: valida PKCE (S256) contra `gym_mcp.access_grants`,
 *    marca el `code` como usado, y emite `access_token` + `refresh_token`
 *    nuevos.
 *  - `refresh_token`: valida `gym_mcp.refresh_tokens`, emite un
 *    `access_token` NUEVO. El `refresh_token` NO rota en esta iteración
 *    (simplificación consciente documentada más abajo).
 *
 * Todo lo secreto (`code`, `access_token`, `refresh_token`) se guarda
 * hasheado (sha256 hex) en la base — nunca en texto plano.
 */
import { createHash, randomBytes } from "node:crypto";
import { queryReadonly, queryService } from "../db.js";

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
}

export interface OAuthError {
  error: string;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** `base64url(sha256(value))` — Node 16+ soporta `'base64url'` directo en `digest`. */
function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

interface ProfileNameRow {
  first_name: string | null;
  last_name: string | null;
}

/** `coach_label` para `access_tokens`: se resuelve en cada emisión de access_token, nunca se guarda en `refresh_tokens`. */
async function resolveCoachLabel(coachProfileId: string): Promise<string> {
  const rows = await queryReadonly<ProfileNameRow>(
    `select first_name, last_name from public.profiles where id = $1`,
    [coachProfileId],
  );
  const profile = rows[0];
  if (!profile) return "coach";
  const label = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return label.length > 0 ? label : "coach";
}

async function issueAccessToken(input: {
  clientId: string;
  coachProfileId: string;
  coachLabel: string;
}): Promise<string> {
  const accessToken = randomBytes(32).toString("hex");
  await queryService(
    `insert into gym_mcp.access_tokens
       (token_hash, client_id, coach_profile_id, coach_label, expires_at)
     values ($1, $2, $3, $4, now() + interval '1 hour')`,
    [sha256Hex(accessToken), input.clientId, input.coachProfileId, input.coachLabel],
  );
  return accessToken;
}

async function issueRefreshToken(input: { clientId: string; coachProfileId: string }): Promise<string> {
  const refreshToken = randomBytes(32).toString("hex");
  await queryService(
    `insert into gym_mcp.refresh_tokens
       (token_hash, client_id, coach_profile_id, expires_at)
     values ($1, $2, $3, now() + interval '30 days')`,
    [sha256Hex(refreshToken), input.clientId, input.coachProfileId],
  );
  return refreshToken;
}

export interface ExchangeAuthorizationCodeInput {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}

interface AccessGrantRow {
  client_id: string;
  coach_profile_id: string;
  redirect_uri: string;
  code_challenge: string;
  expires_at: string;
  used_at: string | null;
}

/**
 * Paso 1 de `authorization_code`: busca el grant por `sha256(code)`, y
 * rechaza (`invalid_grant`) si no existe, ya fue usado, expiró, o
 * `client_id`/`redirect_uri` no matchean lo que se guardó en `/authorize/callback`.
 */
export async function exchangeAuthorizationCode(
  input: ExchangeAuthorizationCodeInput,
): Promise<TokenResponse | OAuthError> {
  const codeHash = sha256Hex(input.code);

  const grants = await queryService<AccessGrantRow>(
    `select client_id, coach_profile_id, redirect_uri, code_challenge, expires_at, used_at
     from gym_mcp.access_grants
     where code_hash = $1`,
    [codeHash],
  );
  const grant = grants[0];

  if (
    !grant ||
    grant.used_at !== null ||
    new Date(grant.expires_at).getTime() <= Date.now() ||
    grant.client_id !== input.clientId ||
    grant.redirect_uri !== input.redirectUri
  ) {
    return { error: "invalid_grant" };
  }

  if (base64UrlSha256(input.codeVerifier) !== grant.code_challenge) {
    return { error: "invalid_grant" };
  }

  // Marcar usado ANTES de emitir los tokens: si algo falla después de esta
  // línea, un reintento con el mismo `code` de todos modos cae en
  // `used_at !== null` de arriba — un `code` se usa UNA sola vez.
  await queryService(`update gym_mcp.access_grants set used_at = now() where code_hash = $1`, [codeHash]);

  const coachLabel = await resolveCoachLabel(grant.coach_profile_id);
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken({ clientId: grant.client_id, coachProfileId: grant.coach_profile_id, coachLabel }),
    issueRefreshToken({ clientId: grant.client_id, coachProfileId: grant.coach_profile_id }),
  ]);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
  };
}

export interface RefreshAccessTokenInput {
  refreshToken: string;
  clientId: string;
}

interface RefreshTokenRow {
  client_id: string;
  coach_profile_id: string;
  expires_at: string;
  revoked_at: string | null;
}

/**
 * `grant_type=refresh_token`: NO rotamos el refresh token en esta iteración
 * (simplificación consciente, T14) — se reusa el mismo `refresh_token` que
 * mandó el cliente hasta que expire (30 días) o se revoque a mano
 * (`UPDATE gym_mcp.refresh_tokens SET revoked_at = now() ...`, mismo criterio
 * manual que el resto de Fase 1). Solo se emite un `access_token` nuevo.
 */
export async function refreshAccessToken(input: RefreshAccessTokenInput): Promise<TokenResponse | OAuthError> {
  const tokenHash = sha256Hex(input.refreshToken);

  const rows = await queryService<RefreshTokenRow>(
    `select client_id, coach_profile_id, expires_at, revoked_at
     from gym_mcp.refresh_tokens
     where token_hash = $1`,
    [tokenHash],
  );
  const row = rows[0];

  if (
    !row ||
    row.revoked_at !== null ||
    new Date(row.expires_at).getTime() <= Date.now() ||
    row.client_id !== input.clientId
  ) {
    return { error: "invalid_grant" };
  }

  // Se re-resuelve coach_label en vez de guardarlo en refresh_tokens: evita
  // que un cambio de nombre en profiles quede "pegado" a un coach_label
  // viejo mientras el refresh token siga vigente (hasta 30 días).
  const coachLabel = await resolveCoachLabel(row.coach_profile_id);
  const accessToken = await issueAccessToken({
    clientId: row.client_id,
    coachProfileId: row.coach_profile_id,
    coachLabel,
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: input.refreshToken,
  };
}
