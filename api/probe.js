export default async function handler(req, res) {
  const base = "https://patch-bundles.api.jmancentral.com";
  const start = Date.now();
  try {
    const listResponse = await fetch(base + "/bundles?ecosystem=reseam&channel=latest&limit=100&offset=0", { signal: AbortSignal.timeout(30000) });
    const list = await listResponse.json();
    const rows = Array.isArray(list.data) ? list.data : [];
    const sampled = await Promise.all(rows.map(async (row) => {
      const sourceUrl = row.source?.url;
      const path = "/api/reseam/patches.json?source_url=" + encodeURIComponent(sourceUrl || "") + "&version=" + encodeURIComponent(row.version || "latest");
      try {
        const response = await fetch(base + path, { signal: AbortSignal.timeout(20000), headers: {accept:"application/json"} });
        const data = await response.json();
        const releases = Array.isArray(data.releases) ? data.releases : [];
        const matching = releases.find((release) => String(release.version) === String(row.version)) || releases[0] || {};
        return {bundle:{id:row.id,name:data.bundle?.name,author:data.bundle?.author,description:data.bundle?.description,homepage:data.bundle?.homepage,indexUrl:sourceUrl,version:row.version,updatedAt:row.created_at,patchCount:row.patch_count,iconUrl:row.icon_url||row.owner_avatar_url,metadataStatus:row.metadata_status,keys:Object.keys(row)}, status:response.status,topKeys:Object.keys(data||{}),nativeBundle:data.bundle,releaseCount:releases.length,releaseKeys:Object.keys(matching),releaseVersion:matching.version,releaseDate:matching.created_at,releasePatchCount:Array.isArray(matching.patches)?matching.patches.length:null,patchSample:Array.isArray(matching.patches)?matching.patches.slice(0,1):[],releaseSample:releases.slice(0,2).map(r=>({version:r.version,created_at:r.created_at,prerelease:r.prerelease,description:r.description,patchCount:r.patches?.length}))};
      } catch (error) { return {bundleId:row.id,sourceUrl,error:String(error)}; }
    }));
    res.setHeader("Cache-Control","no-store");
    res.status(200).json({durationMs:Date.now()-start,status:listResponse.status,keys:Object.keys(list||{}),total:list.total,rowCount:rows.length,sampled});
  } catch(error) {
    res.setHeader("Cache-Control","no-store");
    res.status(500).json({error:String(error),stack:error?.stack});
  }
}
