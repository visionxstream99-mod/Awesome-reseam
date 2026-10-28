import fs from "node:fs";

const file = process.argv[2] || "public/catalog.json";
const errors = [];
const fail = (message) => errors.push(message);
const check = (condition, message) => { if (!condition) fail(message); };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error("Catalog validation failed: cannot parse " + file + ": " + error.message);
  process.exit(1);
}

check(isObject(catalog), "Catalog root must be an object.");
check(Array.isArray(catalog.apps), "catalog.apps must be an array.");
check(Array.isArray(catalog.bundles), "catalog.bundles must be an array.");
check(Array.isArray(catalog.community), "catalog.community must be an array.");
check(isObject(catalog.official) && Array.isArray(catalog.official.patches), "catalog.official.patches must be an array.");
check(Array.isArray(catalog.whatsNew), "catalog.whatsNew must be an array.");

const appMap = new Map();
for (const app of catalog.apps || []) {
  check(typeof app.packageName === "string" && app.packageName.trim(), "Every app must have a packageName.");
  if (appMap.has(app.packageName)) fail("Duplicate app package: " + app.packageName);
  appMap.set(app.packageName, app);
  check(Array.isArray(app.patches), "App " + app.packageName + " must have a patches array.");
  if (Array.isArray(app.patches) && Number.isFinite(Number(app.patchCount))) {
    check(Number(app.patchCount) === app.patches.length, "App patchCount mismatch for " + app.packageName + ".");
  }
}

const bundleNames = new Set();
for (const bundle of catalog.bundles || []) {
  check(typeof bundle.name === "string" && bundle.name.trim(), "Every bundle summary needs a name.");
  if (bundleNames.has(bundle.name)) fail("Duplicate bundle summary: " + bundle.name);
  bundleNames.add(bundle.name);
  for (const field of ["homepage","indexUrl","addUrl","releaseUrl"]) {
    if (bundle[field]) check(validUrl(bundle[field]), "Invalid " + field + " URL for bundle " + bundle.name + ".");
  }
}

for (const source of catalog.community || []) {
  check(typeof source.name === "string" && source.name.trim(), "Every community source needs a name.");
  check(Array.isArray(source.patches), "Community source " + source.name + " must have a patches array.");
  const ids = new Set();
  for (const patch of source.patches || []) {
    check(typeof patch.id === "string" && patch.id.trim(), "Patch in " + source.name + " is missing an ID.");
    if (ids.has(patch.id)) fail("Duplicate patch ID " + patch.id + " in " + source.name + ".");
    ids.add(patch.id);
    check(typeof patch.name === "string" && patch.name.trim(), "Patch " + patch.id + " is missing a name.");
    check(Array.isArray(patch.apps), "Patch " + patch.id + " must have an apps array.");
    check(Array.isArray(patch.options), "Patch " + patch.id + " must have an options array.");
    for (const target of patch.apps || []) {
      check(typeof target.package === "string" && target.package.trim(), "Patch " + patch.id + " has an invalid package target.");
      check(Array.isArray(target.versions), "Patch " + patch.id + " has invalid version metadata.");
    }
  }
}

for (const update of catalog.whatsNew || []) {
  check(typeof update.version === "string" && update.version.trim(), "Release update is missing a version.");
  check(typeof update.sourceName === "string" && update.sourceName.trim(), "Release update is missing a source name.");
  if (update.createdAt !== null && update.createdAt !== undefined && update.createdAt !== "") {
    check(validDate(update.createdAt), "Release update has an invalid timestamp: " + update.sourceName + " / " + update.version + ".");
  }
  if (update.sourceUrl) check(validUrl(update.sourceUrl), "Release update has an invalid source URL: " + update.sourceName + ".");
}

const expectedRj = new Map([
  ["app.rj.adm.patches.removeAds", { packageName:"com.dv.adm", version:"7.6" }],
  ["app.rj.anixart.patches.removeAds", { packageName:"com.swiftsoft.anixartd", version:"10.5" }],
  ["app.rj.hyperlock.patches.removeAds", { packageName:"com.appiolab.hyperlockscreenos", version:"0.1.2" }],
  ["app.rj.hyperlock.patches.customizeHyperLock", { packageName:"com.appiolab.hyperlockscreenos", version:"0.1.2" }],
  ["app.rj.pinterest.patches.removeAdvertisingIdPermission", { packageName:"com.pinterest", version:"14.42.0" }],
  ["app.rj.pinterest.patches.optOutGoogleAnalytics", { packageName:"com.pinterest", version:"14.42.0" }],
  ["app.rj.pinterest.patches.disablePrivacySandboxAdServices", { packageName:"com.pinterest", version:"14.42.0" }],
  ["app.rj.pinterest.patches.disableGoogleEngageReceiver", { packageName:"com.pinterest", version:"14.42.0" }]
]);

const rj = (catalog.community || []).find((source) => source.name === "rj-reseam-patches");
check(Boolean(rj), "RJ community bundle is missing.");
if (rj) {
  check(rj.patches.length === expectedRj.size, "RJ bundle must contain exactly " + expectedRj.size + " current patches.");
  check(typeof rj.version === "string" && rj.version.trim() && rj.version !== "latest", "RJ bundle must use a published release version, not a fabricated 'latest' label.");
  check(validDate(rj.updatedAt), "RJ bundle updatedAt must come from a real published release timestamp.");
  check(validUrl(rj.releaseUrl), "RJ bundle must link to a valid release page.");
  check(validUrl(rj.addUrl) && /\.reseam(?:$|[?#])/i.test(rj.addUrl), "RJ Add URL must point to a .reseam bundle asset.");
  check(rj.patchCount === expectedRj.size && rj.patchCount === rj.patches.length, "RJ patch count must match the actual patch list.");
  for (const [id, expected] of expectedRj) {
    const patch = rj.patches.find((item) => item.id === id);
    check(Boolean(patch), "RJ patch is missing: " + id);
    if (!patch) continue;
    check(patch.apps?.length === 1 && patch.apps[0]?.package === expected.packageName, "Wrong package target for " + id + ".");
    check(patch.apps?.[0]?.versions?.includes(expected.version), "Wrong supported app version for " + id + ".");
    check(patch.sourceVersion === rj.version, "RJ patch " + id + " must use the published bundle version.");
    const app = appMap.get(expected.packageName);
    check(Boolean(app), "App card is missing for RJ target package " + expected.packageName + ".");
    if (app) check(app.patches.some((candidate) => candidate.id === id), "App " + expected.packageName + " is missing patch " + id + ".");
  }
  check(!rj.patches.some((patch) => (patch.apps || []).some((target) => target.package === "com.anixart.dante")), "RJ Anixart patch uses a stale package name.");
  for (const update of (catalog.whatsNew || []).filter((item) => item.sourceName === "rj-reseam-patches")) {
    check(update.version !== "latest", "RJ What's New contains a synthetic 'latest' patch entry.");
    check(validDate(update.createdAt), "RJ What's New entry needs an actual release timestamp.");
  }
}

if (errors.length) {
  console.error("Catalog validation failed for " + file + ":");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Catalog validation passed: " + (catalog.apps || []).length + " apps, " + (catalog.bundles || []).length + " bundle summaries, " + (catalog.whatsNew || []).length + " release updates.");
