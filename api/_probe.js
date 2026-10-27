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
      try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }
      return { path, status: response.status, headers: {
        contentType: response.headers.get("content-type"),
        cors: response.headers.get("access-control-allow-origin"),
        cache: response.headers.get("cache-control")
      }, data };
    } catch (error) {
      return { path, error: String(error) };
    }
  }));
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ probedAt: new Date().toISOString(), results });
}
