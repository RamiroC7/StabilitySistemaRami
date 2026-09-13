/**
 * Metadata OAuth 2.1 estándar (T11, US-2/US-7, design.md > Interfaces /
 * contracts). Sin estado, sin DB — puro cálculo a partir del `issuer`.
 *
 * `issuer` se calcula en `http.ts` a partir del protocolo+host de la request
 * real (con `GYM_OWNER_MCP_HTTP_PORT` como fallback para local) — este
 * archivo no hardcodea `localhost` ni ningún dominio, lo recibe como
 * parámetro.
 */

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

/** `GET /.well-known/oauth-authorization-server`. */
export function buildAuthServerMetadata(issuer: string): AuthServerMetadata {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
}

/** `GET /.well-known/oauth-protected-resource`. */
export function buildProtectedResourceMetadata(issuer: string): ProtectedResourceMetadata {
  return {
    resource: `${issuer}/mcp`,
    authorization_servers: [issuer],
  };
}
