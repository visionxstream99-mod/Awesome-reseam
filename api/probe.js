export default async function handler(req, res) {
  const base = "https://patch-bundles.api.jmancentral.com";
  const call = async (path) => {
    const start = Date.now();
    try {
      const response = await fetch(base + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
      const sample = Array.isArray(data?.data) ? data.data.slice(0, 1) : Array.isArray(data?.rows) ? data.rows.slice(0, 1) : data;
      return { path, status: response.status, ms: Date.now() - start, headers: { cache: response.headers.get("cache-control") }, keys: data && typeof data === "object" ? Object.keys(data) : [], total: data?.total, count: Array.isArray(data?.data) ? data.data.length : Array.isArray(data?.rows) ? data.rows.length : null, next_cursor: data?.next_cursor, sample };
    } catch (error) { return { path, ms: Date.now() - start, error: String(error) }; }
  };
  let health;
  try { const response = await fetch(base + "/health", { signal: AbortSignal.timeout(15000) }); health = await response.json(); }
  catch (error) { health = { error: String(error) }; }
  const gen = health?.generation;
  const paths = [
    "/sources?limit=1&offset=0",
    "/bundles?limit=1&offset=0",
    "/apps?limit=1&offset=0",
    "/patches?limit=1&offset=0",
    "/catalog/patches?generation=" + encodeURIComponent(gen || "") + "&limit=1&page_cursor=0"
  ];
  const results = await Promise.all(paths.map(call));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ probedAt: new Date().toISOString(), health, results });
}
