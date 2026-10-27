export default async function handler(req, res) {
  const base = "https://patch-bundles.api.jmancentral.com";
  const paths = [
    "/bundles?ecosystem=reseam&limit=3&offset=0",
    "/bundles?ecosystem=reseam&channel=latest&limit=3&offset=0",
    "/apps?ecosystem=reseam&limit=3&offset=0",
    "/patches?ecosystem=reseam&limit=2&offset=0",
    "/sources?limit=3&offset=0"
  ];
  const call = async (path) => {
    const start = Date.now();
    try {
      const response = await fetch(base + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      const entries = Array.isArray(data?.data) ? data.data : Array.isArray(data?.rows) ? data.rows : [];
      return { path, status: response.status, ms: Date.now() - start, keys: Object.keys(data || {}), total: data?.total, count: entries.length, next_cursor: data?.next_cursor, samples: entries.slice(0, 2).map(row => {
        if (path.startsWith("/sources")) return row;
        if (path.startsWith("/bundles")) return {id:row.id,name:row.name,author:row.author,version:row.version,ecosystem:row.ecosystem,bundle_type:row.bundle_type,is_latest:row.is_latest,is_prerelease:row.is_prerelease,patch_count:row.patch_count,patch_list_available:row.patch_list_available,metadata_status:row.metadata_status,source:row.source,keys:Object.keys(row)};
        return {id:row.id,name:row.name,description:row.description,bundle_id:row.bundle_id,source_id:row.source_id,metadata_status:row.metadata_status,options:row.options,packages:row.packages,keys:Object.keys(row)};
      })};
    } catch(error) {return {path,ms:Date.now()-start,error:String(error)};}
  };
  res.setHeader("Cache-Control","no-store");
  res.status(200).json({probedAt:new Date().toISOString(),results:await Promise.all(paths.map(call))});
}
