export default async function handler(req, res) {
  const base = "https://patch-bundles.api.jmancentral.com";
  const paths = [
    "/health",
    "/bundles?limit=2&offset=0",
    "/apps?limit=2&offset=0",
    "/patches?limit=2&offset=0",
    "/catalog/patches?limit=2&page_cursor=0"
  ];
  const results = await Promise.all(paths.map(async (path) => {
    try {
      const response = await fetch(base + path, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12000)
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
      if (data && typeof data === "object") {
        const keys = Object.keys(data);
        const nested = data.data || data.rows || data;
        return { path, status: response.status, keys, total: data.total, generation: data.generation, count: Array.isArray(nested) ? nested.length : null, sample: Array.isArray(nested) ? nested.slice(0, 2) : nested };
      }
      return { path, status: response.status, data };
    } catch (error) {
      return { path, error: String(error) };
    }
  }));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ probedAt: new Date().toISOString(), results });
}
