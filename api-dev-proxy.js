// DEV ONLY — No se despliega. Simula /api/posthog-query localmente.
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

const POSTHOG_PROJECT_ID = env["VITE_POSTHOG_PROJECT_ID"];
const POSTHOG_PERSONAL_API_KEY = env["VITE_POSTHOG_PERSONAL_API_KEY"];
const POSTHOG_HOST = env["VITE_POSTHOG_HOST"] || "https://us.posthog.com";

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3333");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
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
});
