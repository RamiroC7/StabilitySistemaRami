// DEV ONLY — No se despliega. Simula /api/posthog-query y /api/ai-chat
// localmente para poder probar el dashboard y el asistente de IA con
// `npm run dev` (correr este archivo aparte con: node api-dev-proxy.js)
// Leer .env manualmente (Vite no lo expone a Node)
import { readFileSync } from "fs";
import { createServer } from "http";

// Parsear .env
const envContent = readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) env[key.trim()] = rest.join("=").trim();
}

// api/ai-chat.js lee sus credenciales de process.env (así funciona también
// en Vercel), así que las copiamos ahí ANTES de importar ese archivo. Import
// dinámico (en vez de uno normal arriba del todo) a propósito: un import
// normal se ejecuta antes que el resto del archivo sin importar en qué
// línea esté escrito, y api/ai-chat.js leería el env todavía vacío.
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const { default: aiChatHandler } = await import("./api/ai-chat.js");

const POSTHOG_PROJECT_ID = env["VITE_POSTHOG_PROJECT_ID"];
const POSTHOG_PERSONAL_API_KEY = env["VITE_POSTHOG_PERSONAL_API_KEY"];
const POSTHOG_HOST = env["VITE_POSTHOG_HOST"] || "https://us.posthog.com";

// Shim mínimo para que un handler estilo Vercel (req, res) funcione sobre
// el http nativo de Node.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function withVercelResShim(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3333");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/api/ai-chat") {
    withVercelResShim(res);
    try {
      req.body = req.method === "POST" ? await readJsonBody(req) : {};
    } catch {
      res.status(400).json({ error: "JSON inválido" });
      return;
    }
    try {
      await aiChatHandler(req, res);
    } catch (err) {
      console.error("[proxy] ❌ ai-chat error:", err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    }
    return;
  }

  if (req.url !== "/api/posthog-query" || req.method !== "POST") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { query } = JSON.parse(body);
      const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
      console.log("[proxy] → Query:", query.substring(0, 80) + "...");
      const phRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      });
      const data = await phRes.json();
      console.log("[proxy] ← Rows:", data.results?.length, "| First:", JSON.stringify(data.results?.[0]));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ results: data.results || [] }));
    } catch (err) {
      console.error("[proxy] ❌ Error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
});

server.listen(3334, () => {
  console.log("✅ [API dev proxy] http://localhost:3334/api/posthog-query");
  console.log("✅ [API dev proxy] http://localhost:3334/api/ai-chat");
});
