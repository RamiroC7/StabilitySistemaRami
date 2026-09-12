import { describe, expect, it } from "vitest";
import { buildAuthServerMetadata, buildProtectedResourceMetadata } from "./metadata.js";

const ISSUER = "https://gym-owner-mcp.example.vercel.app";

describe("buildAuthServerMetadata", () => {
  it("devuelve el shape correcto para un issuer de ejemplo", () => {
    expect(buildAuthServerMetadata(ISSUER)).toEqual({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      registration_endpoint: `${ISSUER}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });
});

describe("buildProtectedResourceMetadata", () => {
  it("devuelve el shape correcto para un issuer de ejemplo", () => {
    expect(buildProtectedResourceMetadata(ISSUER)).toEqual({
      resource: `${ISSUER}/mcp`,
      authorization_servers: [ISSUER],
    });
  });
});
