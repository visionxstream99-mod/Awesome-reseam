export default async function handler(req, res) {
  const base = "https://patch-bundles.api.jmancentral.com";
  try {
    const healthResponse = await fetch(base + "/health", { signal: AbortSignal.timeout(15000) });
    const health = await healthResponse.json();
    const response = await fetch(base + "/bundles?ecosystem=reseam&channel=latest&limit=100&offset=0", { signal: AbortSignal.timeout(30000) });
    const list = await response.json();
    const rows = Array.isArray(list.data) ? list.data : [];
    const samples = await Promise.all(rows.map(async (bundle) => {
      const path = "/catalog/patches?bundle_id=" + encodeURIComponent(bundle.id) + "&generation=" + encodeURIComponent(health.generation) + "&limit=3&page_cursor=0";
      try {
        const r = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
        const data = await r.json();
        return {bundle:{id:bundle.id,version:bundle.version,sourceUrl:bundle.source?.url,patch_count:bundle.patch_count,is_prerelease:bundle.is_prerelease,is_latest:bundle.is_latest},status:r.status,keys:Object.keys(data||{}),generation:data.generation,next_cursor:data.next_cursor,rows:(data.rows||[]).slice(0,2).map(p=>({keys:Object.keys(p),id:p.id,name:p.name,description:p.description,options:p.options,packages:p.packages,compatiblePackages:p.compatiblePackages,patch_packages:p.patch_packages,bundle:p.bundle}))};
      } catch(error) { return {bundleId:bundle.id,error:String(error)}; }
    }));
    res.setHeader("Cache-Control","no-store");
    res.status(200).json({generation:health.generation,bundleTotal:list.total,bundleCount:rows.length,samples});
  } catch(error) {
    res.setHeader("Cache-Control","no-store");
    res.status(500).json({error:String(error)});
  }
}
