import { describe, expect, it } from "vitest";
import { renderAuthorizePage } from "./authorize-page.js";

const BASE_PARAMS = {
  client_id: "abc123",
  redirect_uri: "https://claude.ai/api/mcp/callback",
  code_challenge: "challenge-xyz",
  state: "state-123",
  supabaseUrl: "https://project-ref.supabase.co",
  supabaseAnonKey: "anon-key-fake",
};

describe("renderAuthorizePage", () => {
  it("incluye el script tag de supabase-js ANTES del script inline", () => {
    const html = renderAuthorizePage(BASE_PARAMS);

    const cdnIndex = html.indexOf(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
    );
    const inlineIndex = html.indexOf("window.supabase.createClient");

    expect(cdnIndex).toBeGreaterThan(-1);
    expect(inlineIndex).toBeGreaterThan(-1);
    expect(cdnIndex).toBeLessThan(inlineIndex);
  });

  it("interpola los valores esperados (client_id, redirect_uri, code_challenge, state, supabase config)", () => {
    const html = renderAuthorizePage(BASE_PARAMS);

    expect(html).toContain(BASE_PARAMS.client_id);
    expect(html).toContain(BASE_PARAMS.redirect_uri);
    expect(html).toContain(BASE_PARAMS.code_challenge);
    expect(html).toContain(BASE_PARAMS.state);
    expect(html).toContain(BASE_PARAMS.supabaseUrl);
    expect(html).toContain(BASE_PARAMS.supabaseAnonKey);
  });

  it("hace POST a /authorize/callback y sigue redirect_to con window.location.href", () => {
    const html = renderAuthorizePage(BASE_PARAMS);

    expect(html).toContain("/authorize/callback");
    expect(html).toContain("supabase_access_token");
    expect(html).toContain("window.location.href");
  });

  it("escapa comillas/ángulos al interpolar valores potencialmente hostiles (XSS trivial)", () => {
    const html = renderAuthorizePage({
      ...BASE_PARAMS,
      state: "\"><script>alert(1)</script>",
    });

    expect(html).not.toContain("\"><script>alert(1)</script>");
  });

  it("muestra un elemento de error en la página (sin redirigir en caso de fallo)", () => {
    const html = renderAuthorizePage(BASE_PARAMS);

    expect(html).toContain('id="error"');
  });
});
