const REGISTRY_BASE = "https://patch-bundles.api.jmancentral.com";
const CACHE_TTL_MS = 2 * 60 * 1000;
const API_TIMEOUT_MS = 25000;
const RJ_SOURCE_URL = "https://github.com/visionxstream99-mod/RJ-reseam-patches";
const RJ_REPO_API_URL = "https://api.github.com/repos/visionxstream99-mod/RJ-reseam-patches";
const RJ_FALLBACK_RELEASE = Object.freeze({
  version: "v0.1.1",
  createdAt: "2026-10-27T06:01:24Z",
  description: "Add to Reseam Manager\n• Add HyperLock patches alongside Pinterest\n• Add experimental Pinterest 14.42.0 privacy patches\n• docs: redesign README and clarify patch status",
  prerelease: false,
  releaseUrl: "https://github.com/visionxstream99-mod/RJ-reseam-patches/releases/tag/v0.1.1",
  bundleUrl: "https://github.com/visionxstream99-mod/RJ-reseam-patches/releases/download/v0.1.1/rj-reseam-patches.reseam"
});
const APP_METADATA_OVERRIDES = Object.freeze({
  "com.dv.adm": { name: "Advanced Download Manager", category: "Tools" },
  "com.swiftsoft.anixartd": { name: "Anixart", category: "Video" },
  "com.appiolab.hyperlockscreenos": { name: "HyperLock Screen & AOD", category: "Personalization" },
  "com.pinterest": { name: "Pinterest", category: "Photography" }
});

let cachedCatalog = null;
let cacheExpiresAt = 0;
let inFlightBuild = null;

class CatalogGenerationChanged extends Error {
  constructor() {
    super("The registry catalog changed while it was being read.");
    this.name = "CatalogGenerationChanged";
  }
}

function makeUrl(path, params = {}) {
  const url = new URL(path, REGISTRY_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readJson(url, { allowNotFound = false } = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 409 && url.includes("/catalog/patches")) {
    throw new CatalogGenerationChanged();
  }
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : "Registry returned HTTP " + response.status;
    const error = new Error(message);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  if (!data || typeof data !== "object") throw new Error("Registry returned invalid JSON.");
  return data;
}

async function readList(path, params = {}) {
  const all = [];
  let offset = 0;
  let total = null;

  for (let page = 0; page < 101; page += 1) {
    const data = await readJson(makeUrl(path, { ...params, limit: 100, offset }));
    if (!Array.isArray(data.data)) throw new Error("Registry list response did not include a data array.");
    all.push(...data.data);
    total = Number.isFinite(Number(data.total)) ? Number(data.total) : all.length;
    if (all.length >= total || data.data.length === 0) break;
    offset += Number(data.limit) || data.data.length;
    if (offset > 10000) throw new Error("Registry pagination exceeded the supported offset limit.");
  }

  if (total !== null && all.length < total) {
    throw new Error("Registry returned an incomplete list (" + all.length + " of " + total + ").");
  }
  return all;
}

async function readBundlePatches(bundleId, generation) {
  const patches = [];
  const cursors = new Set();
  let cursor = 0;
  let pageSize = 100;

  for (let page = 0; page < 40; page += 1) {
    const cursorKey = String(cursor);
    if (cursors.has(cursorKey)) throw new Error("Registry returned a repeated patch cursor.");
    cursors.add(cursorKey);

    const url = makeUrl("/catalog/patches", {
      bundle_id: bundleId,
      generation,
      limit: pageSize,
      page_cursor: cursor,
      compact: "true"
    });

    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.status === 409) throw new CatalogGenerationChanged();
    if (response.status === 422 && pageSize > 10) {
      pageSize = Math.max(10, Math.floor(pageSize / 2));
      page -= 1;
      cursors.delete(cursorKey);
      continue;
    }
    if (!response.ok) {
      throw new Error((data && data.error) || "Patch list failed with HTTP " + response.status + ".");
    }
    if (!Array.isArray(data.rows)) throw new Error("Registry patch page did not include rows.");

    patches.push(...data.rows);
    if (data.next_cursor === null || data.next_cursor === undefined || data.next_cursor === "") break;
    cursor = data.next_cursor;
    if (page === 39) throw new Error("Registry patch pagination exceeded its safety limit.");
  }

  return patches.filter((patch) => patch && patch.hidden !== true);
}

function normalizeOption(option) {
  const item = option && typeof option === "object" ? option : {};
  let defaultValue = null;
  if (Object.prototype.hasOwnProperty.call(item, "default_value")) {
    defaultValue = item.default_value;
  } else if (Object.prototype.hasOwnProperty.call(item, "default")) {
    defaultValue = {
      type: item.type || typeof item.default,
      value: item.default
    };
  }
  return {
    key: item.key || item.title || item.name || "option",
    title: item.title || item.name || item.key || "Option",
    description: item.description || "",
    option_type: item.option_type || item.type || "option",
    default_value: defaultValue,
    valid_values: item.valid_values ?? item.values ?? null,
    required: Boolean(item.required)
  };
}

function normalizePackage(item) {
  if (typeof item === "string") return { package: item, versions: [] };
  if (!item || typeof item !== "object") return null;
  const packageName = item.name || item.package || item.package_name;
  if (!packageName) return null;
  return {
    package: String(packageName),
    versions: Array.isArray(item.versions) ? item.versions.map(String) : []
  };
}

function canonicalSourceUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase();
}

function categoryForApp(name, packageName) {
  const value = (String(name || "") + " " + String(packageName || "")).toLowerCase();
  const rules = [
    ["Weather", /weather|accuweather|windy|ventusky|meteoblue/],
    ["Social", /discord|reddit|instagram|facebook|twitter|tiktok|baconreader|threads/],
    ["Personalization", /hyperlock|wallpaper|lock screen|aod|customize/],
    ["Music", /soundcloud|spotify|youtube music|music player|podcast|scrobbler/],
    ["Video", /youtube|netflix|twitch|video player|streaming|crunchyroll|anixart/],
    ["Photography", /pinterest|photo|camera|gallery|picsart|lightroom|snapseed|imgur/],
    ["Productivity", /notion|office|calendar|tasks|notes|todo|documents|drive/],
    ["Development", /github|gitlab|termux|pydroid|code editor|developer|programming/],
    ["Finance", /paypal|wallet|banking|finance|expense|money manager/],
    ["Health & Fitness", /health|fitness|workout|alltrails|myfitnesspal|sleep/],
    ["Education", /learn|language|busuu|duolingo|quiz|academy|dictionary/],
    ["Gaming", /game|minecraft|steam|xbox|playstation/],
    ["Tools", /adguard|launcher|vpn|file manager|explorer|browser|cloudflare|warp/]
  ];
  const match = rules.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : "Other";
}

function isOfficialBundle(record, metadata) {
  const sourceUrl = record && record.source && record.source.url;
  return sourceUrl === "https://git.reseam.app/reseam/patches" ||
    (metadata && metadata.name === "reseam-patches" && metadata.author === "Reseam");
}

async function readNativeHistory(sourceUrl) {
  if (!sourceUrl) return null;
  const url = makeUrl("/api/reseam/patches.json", {
    source_url: sourceUrl,
    version: "latest",
    channel: "any"
  });
  try {
    return await readJson(url, { allowNotFound: true });
  } catch {
    return null;
  }
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function cleanReleaseDescription(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\x60([^\x60]+)\x60/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function normalizeRelease(release, bundleName, sourceUrl) {
  return {
    version: release && release.version ? String(release.version) : "Unknown version",
    createdAt: normalizeTimestamp(release && (release.created_at || release.createdAt || release.published_at)),
    description: cleanReleaseDescription(release && release.description),
    prerelease: Boolean(release && (release.prerelease || release.is_prerelease)),
    sourceName: bundleName,
    sourceUrl
  };
}

async function readLatestRjRelease() {
  try {
    const response = await fetch(RJ_REPO_API_URL + "/releases/latest", {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "awesome-reseam-catalog"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return RJ_FALLBACK_RELEASE;

    const release = await response.json();
    if (!release || typeof release.tag_name !== "string" || !release.tag_name.trim()) return RJ_FALLBACK_RELEASE;

    const assets = Array.isArray(release.assets) ? release.assets : [];
    const bundleAsset = assets.find((asset) =>
      typeof asset?.name === "string" &&
      /\.reseam$/i.test(asset.name) &&
      typeof asset.browser_download_url === "string"
    );

    return {
      version: release.tag_name.trim(),
      createdAt: normalizeTimestamp(release.published_at || release.created_at) || RJ_FALLBACK_RELEASE.createdAt,
      description: cleanReleaseDescription(release.body),
      prerelease: Boolean(release.prerelease),
      releaseUrl: typeof release.html_url === "string" ? release.html_url : RJ_SOURCE_URL + "/releases/latest",
      bundleUrl: bundleAsset?.browser_download_url || RJ_FALLBACK_RELEASE.bundleUrl
    };
  } catch {
    // Keep the last known published metadata; never invent a release date.
    return RJ_FALLBACK_RELEASE;
  }
}

async function buildCatalogOnce() {
  const [health, rjRelease, bundleRecords, appRecords] = await Promise.all([
    readJson(makeUrl("/health")),
    readLatestRjRelease(),
    readList("/bundles", { ecosystem: "reseam", channel: "latest" }),
    readList("/apps", { ecosystem: "reseam" }).catch(() => [])
  ]);
  if (!health.generation) throw new Error("Registry health response did not include a catalog generation.");

  const currentBundles = bundleRecords
    // RJ is maintained below with verified release metadata; avoid a duplicate registry copy.
    .filter((record) =>
      record && record.source && record.source.url && record.source.enabled !== false &&
      canonicalSourceUrl(record.source.url) !== canonicalSourceUrl(RJ_SOURCE_URL)
    )
    .sort((a, b) => {
      const officialA = isOfficialBundle(a, a.reseam_bundle);
      const officialB = isOfficialBundle(b, b.reseam_bundle);
      return Number(officialB) - Number(officialA) ||
        String(a.reseam_bundle && a.reseam_bundle.name || "").localeCompare(String(b.reseam_bundle && b.reseam_bundle.name || ""));
    });

  if (!currentBundles.length) throw new Error("The registry returned no current Reseam sources.");

  const patchResults = await Promise.all(currentBundles.map(async (record) => {
    try {
      return { record, patches: await readBundlePatches(record.id, health.generation), error: null };
    } catch (error) {
      if (error instanceof CatalogGenerationChanged) throw error;
      return { record, patches: [], error: String(error && error.message || error) };
    }
  }));

  const successfulLists = patchResults.filter((result) => !result.error);
  if (!successfulLists.length && currentBundles.some((record) => Number(record.patch_count || 0) > 0)) {
    throw new Error("The registry did not return any current patch lists.");
  }

  const historyResults = await Promise.all(currentBundles.map(async (record) => ({
    record,
    history: await readNativeHistory(record.source && record.source.url)
  })));

  const categoryMap = new Map();
  const packageSummaryMap = new Map();
  for (const item of appRecords) {
    if (!item || !item.package_name) continue;
    packageSummaryMap.set(item.package_name, item);
    categoryMap.set(item.package_name, categoryForApp(item.app_name, item.package_name));
  }

  const bundleItems = [];
  const bundles = [];
  const allPatches = [];
  const staleSources = [];
  const whatsNew = [];
  const historyBySource = new Map();

  for (const result of patchResults) {
    const record = result.record;
    const source = record.source || {};
    const metadata = record.reseam_bundle || {};
    const sourceMeta = source.source_metadatum || {};
    const official = isOfficialBundle(record, metadata);
    const name = metadata.name || source.repo || source.namespace || "Unknown source";
    const author = metadata.author || sourceMeta.owner_name || source.namespace || "Community";
    const description = metadata.description || sourceMeta.repo_description || "";
    const homepage = metadata.homepage || source.url || "";
    const iconUrl = record.icon_url || record.owner_avatar_url || sourceMeta.bundle_icon_url || sourceMeta.owner_avatar_url || null;

    const patches = result.patches.map((item) => {
      const patchPackages = Array.isArray(item.packages) ? item.packages :
        (Array.isArray(item.compatiblePackages) ? item.compatiblePackages : []);
      const apps = patchPackages.map(normalizePackage).filter(Boolean);
      return {
        id: item.id || item.catalog_id || name + ":" + (item.name || "patch"),
        name: item.name || "Name unavailable",
        description: item.description || "",
        bundle: name,
        sourceName: name,
        sourceUrl: source.url,
        sourceVersion: record.version || null,
        official,
        apps,
        options: Array.isArray(item.options) ? item.options.map(normalizeOption) : []
      };
    });

    const historyItem = historyResults.find((item) => item.record.id === record.id);
    const native = historyItem && historyItem.history;
    const rawReleases = native && Array.isArray(native.releases) ? native.releases : [];
    let releases = rawReleases.map((release) => normalizeRelease(release, name, source.url));
    if (!releases.length) {
      releases = [normalizeRelease({
        version: record.version,
        created_at: record.created_at,
        description: record.description,
        prerelease: record.is_prerelease
      }, name, source.url)];
    }
    historyBySource.set(source.url, releases);

    const bundleItem = {
      name,
      author,
      description,
      homepage,
      url: official ? "https://reseam.app/patches/" : source.url,
      indexUrl: source.url,
      addUrl: source.url,
      version: record.version || null,
      updatedAt: record.created_at || sourceMeta.repo_pushed_at || null,
      patchCount: patches.length,
      iconUrl,
      isOfficial: official,
      metadataStatus: record.metadata_status || "unknown",
      patchListAvailable: record.patch_list_available !== false,
      sourceId: record.source_id || source.id || null,
      registryBundleId: record.id,
      releaseUrl: record.release_url || null,
      prerelease: Boolean(record.is_prerelease),
      releases,
      patches
    };

    bundleItems.push(bundleItem);
    allPatches.push(...patches);
    for (const release of releases) {
      whatsNew.push({
        version: release.version,
        createdAt: release.createdAt,
        description: release.description,
        prerelease: release.prerelease,
        sourceName: name,
        sourceUrl: source.url
      });
    }
    if (result.error) {
      staleSources.push({ name, url: source.url, error: result.error });
    }
  }

  // RJ patch metadata tracks a real published release; refreshes never create fake timestamps.
  const rjSourceUrl = RJ_SOURCE_URL;
  const rjAddUrl = rjRelease.bundleUrl || RJ_FALLBACK_RELEASE.bundleUrl;
  const rjPatchSpecs = [
  {
    "id": "app.rj.adm.patches.removeAds",
    "name": "Remove ads",
    "description": "Disables ADM 7.6 AdMob, Admax, and AppBrain banner and interstitial ad paths.",
    "apps": [
      {
        "package": "com.dv.adm",
        "versions": [
          "7.6"
        ]
      }
    ],
    "options": []
  },
  {
    "id": "app.rj.anixart.patches.removeAds",
    "name": "Remove ads",
    "description": "Removes banner, interstitial, and Kodik pre-roll ads from Anixart 10.5.",
    "apps": [
      {
        "package": "com.swiftsoft.anixartd",
        "versions": [
          "10.5"
        ]
      }
    ],
    "options": [
      {
        "key": "removeBannerAds",
        "title": "Banner ads",
        "description": "Hides the bottom banner and its ad label.",
        "type": "boolean",
        "default": true
      },
      {
        "key": "removeInterstitialAds",
        "title": "Interstitial ads",
        "description": "Stops Yandex interstitial ads from loading or showing.",
        "type": "boolean",
        "default": true
      },
      {
        "key": "removeKodikPreRoll",
        "title": "Kodik pre-roll ads",
        "description": "Ends the Kodik ad activity before the ad player initializes and skips its one-time information prompt.",
        "type": "boolean",
        "default": true
      }
    ]
  },
  {
    "id": "app.rj.hyperlock.patches.removeAds",
    "name": "Remove ads",
    "description": "Removes HyperLock 0.1.2 banner, native, interstitial, and app-open ads while preserving Play Store validation and purchase/entitlement checks.",
    "apps": [
      {
        "package": "com.appiolab.hyperlockscreenos",
        "versions": [
          "0.1.2"
        ]
      }
    ],
    "options": []
  },
  {
    "id": "app.rj.hyperlock.patches.customizeHyperLock",
    "name": "Customize HyperLock",
    "description": "Optional HyperLock 0.1.2 clock and visual settings. Does not modify Play Store checks, purchases, or premium entitlement.",
    "apps": [
      {
        "package": "com.appiolab.hyperlockscreenos",
        "versions": [
          "0.1.2"
        ]
      }
    ],
    "options": [
      {
        "key": "use12HourClock",
        "title": "Force 12-hour clock",
        "description": "Force 12-hour time across clock styles. Off leaves HyperLock's saved setting unchanged.",
        "type": "boolean",
        "default": false
      },
      {
        "key": "enableDepthEffect",
        "title": "Force depth effects on",
        "description": "Force the existing depth-effect preference on. Off leaves HyperLock's saved setting unchanged.",
        "type": "boolean",
        "default": false
      },
      {
        "key": "enableParallaxAnimation",
        "title": "Force parallax animation on",
        "description": "Force the existing parallax preference on. Off leaves HyperLock's saved setting unchanged.",
        "type": "boolean",
        "default": false
      }
    ]
  },
  {
    "id": "app.rj.pinterest.patches.removeAdvertisingIdPermission",
    "name": "Remove Advertising ID permission",
    "description": "Removes the Google Advertising ID permission from Pinterest 14.42.0.",
    "apps": [
      {
        "package": "com.pinterest",
        "versions": [
          "14.42.0"
        ]
      }
    ],
    "options": []
  },
  {
    "id": "app.rj.pinterest.patches.optOutGoogleAnalytics",
    "name": "Opt out of Google Analytics",
    "description": "Sets Pinterest's four Google Analytics default-consent flags to false.",
    "apps": [
      {
        "package": "com.pinterest",
        "versions": [
          "14.42.0"
        ]
      }
    ],
    "options": []
  },
  {
    "id": "app.rj.pinterest.patches.disablePrivacySandboxAdServices",
    "name": "Disable Privacy Sandbox Ad Services",
    "description": "Removes Pinterest's android.adservices.AD_SERVICES_CONFIG manifest property.",
    "apps": [
      {
        "package": "com.pinterest",
        "versions": [
          "14.42.0"
        ]
      }
    ],
    "options": []
  },
  {
    "id": "app.rj.pinterest.patches.disableGoogleEngageReceiver",
    "name": "Disable Google Engage receiver",
    "description": "Disables Pinterest's Google Engage recommendation broadcast receiver.",
    "apps": [
      {
        "package": "com.pinterest",
        "versions": [
          "14.42.0"
        ]
      }
    ],
    "options": []
  }
];
  const rjPatches = rjPatchSpecs.map((patch) => ({
    ...patch,
    bundle: "rj-reseam-patches",
    sourceName: "rj-reseam-patches",
    sourceUrl: rjSourceUrl,
    sourceVersion: rjRelease.version,
    official: false,
    options: (patch.options || []).map(normalizeOption)
  }));
  const rjReleaseDetails = {
    version: rjRelease.version,
    createdAt: rjRelease.createdAt,
    description: rjRelease.description,
    prerelease: rjRelease.prerelease,
    sourceName: "rj-reseam-patches",
    sourceUrl: rjSourceUrl,
    releaseUrl: rjRelease.releaseUrl
  };

  const rjBundle = {
    name: "rj-reseam-patches",
    author: "RJ",
    description: "RJ community patches for Advanced Download Manager, Anixart, HyperLock Screen & AOD, and Pinterest.",
    homepage: rjSourceUrl,
    url: rjSourceUrl,
    indexUrl: rjSourceUrl,
    addUrl: rjAddUrl,
    version: rjRelease.version,
    updatedAt: rjRelease.createdAt,
    patchCount: rjPatches.length,
    iconUrl: "https://github.com/visionxstream99-mod.png",
    isOfficial: false,
    metadataStatus: "community",
    patchListAvailable: true,
    sourceId: "rj-reseam-patches",
    registryBundleId: null,
    releaseUrl: rjRelease.releaseUrl,
    prerelease: rjRelease.prerelease,
    releases: [rjReleaseDetails],
    patches: rjPatches
  };
  bundleItems.push(rjBundle);
  allPatches.push(...rjPatches);
  // Patches are not releases: show only the actual published release once.
  if (rjReleaseDetails.createdAt) {
    whatsNew.push({
      ...rjReleaseDetails,
      sourceUrl: rjReleaseDetails.releaseUrl || rjSourceUrl
    });
  }


  const appsMap = new Map();
  for (const [packageName, summary] of packageSummaryMap.entries()) {
    appsMap.set(packageName, {
      packageName,
      name: APP_METADATA_OVERRIDES[packageName]?.name || summary.app_name || packageName,
      iconUrl: summary.icon_url || null,
      googlePlayStatus: "unknown",
      googlePlayStatusSource: summary.metadata_source || "registry",
      googlePlayCheckedAt: null,
      googlePlayEvidenceUrl: null,
      googlePlayMarketsChecked: [],
      category: APP_METADATA_OVERRIDES[packageName]?.category || categoryMap.get(packageName) || categoryForApp(summary.app_name, packageName),
      patchCount: 0,
      bundleCount: 0,
      versions: Array.isArray(summary.versions) ? summary.versions : [],
      patches: []
    });
  }

  for (const patch of allPatches) {
    for (const target of patch.apps) {
      const packageName = target.package;
      if (!appsMap.has(packageName)) {
        appsMap.set(packageName, {
          packageName,
          name: APP_METADATA_OVERRIDES[packageName]?.name || packageSummaryMap.get(packageName)?.app_name || packageName,
          iconUrl: packageSummaryMap.get(packageName)?.icon_url || null,
          googlePlayStatus: "unknown",
          googlePlayStatusSource: "registry",
          googlePlayCheckedAt: null,
          googlePlayEvidenceUrl: null,
          googlePlayMarketsChecked: [],
          category: APP_METADATA_OVERRIDES[packageName]?.category || categoryMap.get(packageName) || categoryForApp(packageSummaryMap.get(packageName)?.app_name || packageName, packageName),
          patchCount: 0,
          bundleCount: 0,
          versions: [],
          patches: []
        });
      }
      const app = appsMap.get(packageName);
      if (!app.patches.some((existing) => existing.id === patch.id)) app.patches.push(patch);
      for (const version of target.versions || []) {
        if (!app.versions.includes(version)) app.versions.push(version);
      }
      if (!app.iconUrl) {
        const summary = packageSummaryMap.get(packageName);
        app.iconUrl = summary && summary.icon_url || null;
      }
    }
  }

  const apps = Array.from(appsMap.values()).map((app) => {
    const sourceUrls = new Set(app.patches.map((patch) => patch.sourceUrl).filter(Boolean));
    return {
      ...app,
      patchCount: app.patches.length,
      bundleCount: sourceUrls.size,
      versions: app.versions.sort((a, b) => String(a).localeCompare(String(b)))
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const summaries = bundleItems.map((bundle) => ({
    name: bundle.name,
    author: bundle.author,
    description: bundle.description,
    homepage: bundle.homepage,
    indexUrl: bundle.indexUrl,
    addUrl: bundle.addUrl,
    version: bundle.version,
    updatedAt: bundle.updatedAt,
    patchCount: bundle.patchCount,
    iconUrl: bundle.iconUrl,
    isOfficial: bundle.isOfficial,
    metadataStatus: bundle.metadataStatus,
    prerelease: bundle.prerelease,
    releaseUrl: bundle.releaseUrl
  }));

  whatsNew.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const uniqueWhatsNew = [];
  const newsKeys = new Set();
  for (const release of whatsNew) {
    const key = [release.sourceUrl, release.version, release.createdAt].join("|");
    if (!newsKeys.has(key)) {
      newsKeys.add(key);
      uniqueWhatsNew.push(release);
    }
  }

  const fetchedAt = new Date().toISOString();
  const officialBundle = bundleItems.find((bundle) => bundle.isOfficial);
  const community = bundleItems.filter((bundle) => !bundle.isOfficial).map((bundle) => ({
    ...bundle,
    patchCount: bundle.patches.length
  }));

  return {
    generatedAt: fetchedAt,
    fetchedAt,
    registry: {
      url: REGISTRY_BASE,
      generation: health.generation,
      available: true,
      counts: health.counts || {},
      currentReseamBundleCount: bundleItems.length,
      currentReseamPatchCount: allPatches.length
    },
    official: officialBundle ? {
      name: officialBundle.name,
      author: officialBundle.author,
      description: officialBundle.description,
      homepage: officialBundle.homepage,
      url: officialBundle.url,
      indexUrl: officialBundle.indexUrl,
      addUrl: officialBundle.addUrl,
      version: officialBundle.version,
      updatedAt: officialBundle.updatedAt,
      releases: officialBundle.releases,
      patches: officialBundle.patches
    } : { name: "reseam-patches", author: "Reseam", description: "Official Reseam patches", homepage: "https://reseam.app", url: "https://reseam.app/patches/", indexUrl: "https://git.reseam.app/reseam/patches", addUrl: "https://git.reseam.app/reseam/patches", version: null, updatedAt: null, releases: [], patches: [] },
    community,
    bundles: summaries,
    apps,
    whatsNew: uniqueWhatsNew.slice(0, 60),
    staleSources
  };
}

async function buildCatalog() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await buildCatalogOnce();
    } catch (error) {
      if (error instanceof CatalogGenerationChanged && attempt === 0) continue;
      throw error;
    }
  }
  throw new Error("Unable to read a consistent registry generation.");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const forceRefresh = req.query && (req.query.refresh === "1" || req.query.refresh === "true");
  if (!forceRefresh && cachedCatalog && Date.now() < cacheExpiresAt) {
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    res.setHeader("X-Catalog-Cache", "HIT");
    return res.status(200).json(cachedCatalog);
  }

  if (!forceRefresh && inFlightBuild) {
    try {
      const data = await inFlightBuild;
      res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
      res.setHeader("X-Catalog-Cache", "COALESCED");
      return res.status(200).json(data);
    } catch (error) {
      return res.status(503).json({ error: "Live catalog unavailable.", detail: String(error && error.message || error) });
    }
  }

  try {
    const job = buildCatalog();
    if (!forceRefresh) inFlightBuild = job;
    const data = await job;
    cachedCatalog = data;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    res.setHeader("Cache-Control", forceRefresh ? "no-store" : "public, s-maxage=120, stale-while-revalidate=600");
    res.setHeader("X-Catalog-Cache", "MISS");
    return res.status(200).json(data);
  } catch (error) {
    const message = String(error && error.message || error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Live catalog refresh failed.", detail: message });
  } finally {
    if (!forceRefresh) inFlightBuild = null;
  }
}

export const config = { maxDuration: 60 };
