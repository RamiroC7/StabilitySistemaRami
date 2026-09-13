/**
 * `GET /authorize` — página de login mínima con Supabase Auth (T12, US-2/US-7,
 * design.md > Interfaces / contracts > `GET /authorize`).
 *
 * HTML standalone, sin build step: carga `@supabase/supabase-js` desde CDN
 * (versión `@2` fijada) ANTES del script inline que la usa. El coach loguea
 * con la cuenta que ya tiene (email + password) contra el proyecto Supabase
 * real, con la anon key (pública, ya expuesta en el bundle de la app) — este
 * archivo NUNCA ve ni maneja ninguna password: eso pasa enteramente en el
 * browser, dentro del script inline, vía `supabase-js`.
 *
 * El handler HTTP (`http.ts`, T15) valida `client_id`/`redirect_uri` contra
 * `oauth_clients` ANTES de llamar a `renderAuthorizePage` — si no matchean,
 * responde 400 sin mostrar el form. Esta función no vuelve a validar nada:
 * solo renderiza.
 */

export interface AuthorizePageParams {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** Escape mínimo para interpolar en atributos/texto HTML (XSS trivial). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape para interpolar dentro de un literal string JS entre comillas simples. */
function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/</g, "\\x3C")
    .replace(/\r?\n/g, "\\n");
}

export function renderAuthorizePage(params: AuthorizePageParams): string {
  const clientIdAttr = escapeHtml(params.client_id);
  const redirectUriAttr = escapeHtml(params.redirect_uri);
  const codeChallengeAttr = escapeHtml(params.code_challenge);
  const stateAttr = escapeHtml(params.state);

  const jsClientId = escapeJsString(params.client_id);
  const jsRedirectUri = escapeJsString(params.redirect_uri);
  const jsCodeChallenge = escapeJsString(params.code_challenge);
  const jsState = escapeJsString(params.state);
  const jsSupabaseUrl = escapeJsString(params.supabaseUrl);
  const jsSupabaseAnonKey = escapeJsString(params.supabaseAnonKey);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Stability — Conectar coach</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
</head>
<body>
  <main>
    <h1>Ingresá con tu cuenta de Stability</h1>
    <p>Estás autorizando un conector MCP a leer los datos del gimnasio en tu nombre.</p>
    <form
      id="login-form"
      data-client-id="${clientIdAttr}"
      data-redirect-uri="${redirectUriAttr}"
      data-code-challenge="${codeChallengeAttr}"
      data-state="${stateAttr}"
    >
      <label for="email">Email</label>
      <input type="email" id="email" name="email" autocomplete="email" required />
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required />
      <button type="submit">Ingresar</button>
    </form>
    <p id="error" role="alert"></p>
  </main>
  <script>
    (function () {
      var supabaseClient = window.supabase.createClient('${jsSupabaseUrl}', '${jsSupabaseAnonKey}');
      var form = document.getElementById('login-form');
      var errorEl = document.getElementById('error');

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        errorEl.textContent = '';

        var email = document.getElementById('email').value;
        var password = document.getElementById('password').value;

        supabaseClient.auth
          .signInWithPassword({ email: email, password: password })
          .then(function (result) {
            if (result.error) {
              errorEl.textContent = result.error.message;
              return;
            }
            var accessToken = result.data.session.access_token;
            return fetch('/authorize/callback', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                supabase_access_token: accessToken,
                client_id: '${jsClientId}',
                redirect_uri: '${jsRedirectUri}',
                code_challenge: '${jsCodeChallenge}',
                state: '${jsState}',
              }),
            })
              .then(function (response) {
                return response.json().then(function (body) {
                  return { ok: response.ok, body: body };
                });
              })
              .then(function (result) {
                if (result.ok && result.body && result.body.redirect_to) {
                  window.location.href = result.body.redirect_to;
                } else {
                  errorEl.textContent =
                    (result.body && result.body.error) || 'No se pudo completar el login.';
                }
              });
          })
          .catch(function (err) {
            errorEl.textContent = String((err && err.message) || err);
          });
      });
    })();
  </script>
</body>
</html>
`;
}
