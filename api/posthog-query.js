// Vercel Serverless Function — proxy para queries HogQL de PostHog
// Evita que el SDK de PostHog en el browser intercepte las llamadas a la API

export default async function handler(req, res) {
  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const POSTHOG_PROJECT_ID = process.env.VITE_POSTHOG_PROJECT_ID;
  const POSTHOG_PERSONAL_API_KEY = process.env.VITE_POSTHOG_PERSONAL_API_KEY;
  const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST || "https://us.posthog.com";

  if (!POSTHOG_PROJECT_ID || !POSTHOG_PERSONAL_API_KEY) {
    return res.status(503).json({ error: "PostHog credentials not configured" });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Missing query in body" });
  }

  try {
    const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
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
      console.error("[posthog-query] PostHog error:", response.status, data);
      return res.status(response.status).json(data);
    }

    // CORS headers para que el browser pueda llamar a /api/posthog-query
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ results: data.results || [] });
  } catch (err) {
    console.error("[posthog-query] Fetch error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
