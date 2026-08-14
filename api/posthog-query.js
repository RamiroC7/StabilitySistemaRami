// Vercel Serverless Function — proxy para queries HogQL de PostHog
// Corre server-side: evita que el SDK de PostHog en el browser interfiera

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const POSTHOG_PROJECT_ID = process.env.VITE_POSTHOG_PROJECT_ID;
  const POSTHOG_PERSONAL_API_KEY = process.env.VITE_POSTHOG_PERSONAL_API_KEY;
  const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || "https://us.posthog.com";

  console.log("[posthog-query] PROJECT_ID:", POSTHOG_PROJECT_ID ? "SET" : "MISSING");
  console.log("[posthog-query] API_KEY:", POSTHOG_PERSONAL_API_KEY ? "SET" : "MISSING");

  if (!POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) {
    console.error("[posthog-query] Missing env vars!");
    return res.status(503).json({ error: "PostHog credentials not configured on server" });
  }

  const { query } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: "Missing 'query' in request body" });
  }

  try {
    const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
    console.log("[posthog-query] Calling:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[posthog-query] PostHog returned:", response.status, JSON.stringify(data));
      return res.status(response.status).json({ error: data });
    }

    console.log("[posthog-query] OK — rows:", data.results?.length ?? 0);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ results: data.results || [] });
  } catch (err) {
    console.error("[posthog-query] Fetch exception:", err);
    return res.status(500).json({ error: String(err) });
  }
}
