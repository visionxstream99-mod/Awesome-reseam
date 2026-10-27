import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  BookOpen, Boxes, Check, ChevronDown, CircleHelp, Clock3, Copy, ExternalLink,
  Filter, Github, Grid2X2, Link2, ListFilter, LoaderCircle, Package, RefreshCw,
  Search, ShieldCheck, Smartphone, Sparkles, Store, Tag, X
} from "lucide-react";

const EMPTY_CATALOG = {
  generatedAt: null,
  registry: { url: "https://patch-bundles.api.jmancentral.com", available: false },
  official: { name: "reseam-patches", author: "Reseam", patches: [] },
  community: [],
  bundles: [],
  apps: [],
  whatsNew: [],
  staleSources: []
};

const ADD_URL = "https://reseam.app/add/?url=";
const GITHUB_URL = "https://github.com/visionxstream99-mod/Awesome-reseam";

function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function relativeDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not provided";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0) return formatDate(value);
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 30) return "Updated " + days + " days ago";
  return formatDate(value);
}

function normalizeText(value) {
  return String(value || "").toLocaleLowerCase().trim();
}

function patchSearchText(patch) {
  const apps = (patch.apps || []).map((app) => [app.package, ...(app.versions || [])].join(" ")).join(" ");
  const options = (patch.options || []).map((option) => [option.title, option.key, option.description].join(" ")).join(" ");
  return normalizeText([patch.name, patch.description, patch.id, patch.sourceName, apps, options].join(" "));
}

function getBundlePatches(catalog, bundle) {
  if (!bundle) return [];
  const source = bundle.isOfficial
    ? catalog.official
    : (catalog.community || []).find((item) =>
        item.name === bundle.name ||
        item.indexUrl === bundle.indexUrl ||
        item.addUrl === bundle.addUrl
      );
  return Array.isArray(source && source.patches) ? source.patches : [];
}

function getPatchBundle(catalog, patch) {
  return (catalog.bundles || []).find((bundle) =>
    bundle.name === patch.bundle ||
    bundle.indexUrl === patch.sourceUrl ||
    bundle.name === patch.sourceName
  ) || {
    name: patch.sourceName || patch.bundle || "Unknown source",
    author: patch.sourceName || "Community",
    description: "",
    homepage: patch.sourceUrl,
    indexUrl: patch.sourceUrl,
    addUrl: patch.sourceUrl,
    version: patch.sourceVersion,
    patchCount: 0,
    isOfficial: !!patch.official,
    metadataStatus: "unknown"
  };
}

function bundleAddTarget(bundle) {
  return bundle && (bundle.indexUrl || bundle.addUrl || bundle.homepage);
}

function AddToReseam({ bundle, compact = false }) {
  const url = bundleAddTarget(bundle);
  if (!url) return null;
  return (
    <a
      className={"button button-primary add-button" + (compact ? " button-compact" : "")}
      href={ADD_URL + encodeURIComponent(url)}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      title="Open this source in Reseam"
    >
      <Link2 size={15} />
      <span>{compact ? "Add" : "Add to Reseam"}</span>
      <ArrowUpRight size={14} />
    </a>
  );
}

function Avatar({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = String(name || "R").split(/[\s-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span className={"avatar " + className}>
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{initials || "R"}</span>}
    </span>
  );
}

function IconButton({ label, onClick, children, className = "" }) {
  return <button type="button" className={"icon-button " + className} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function Stat({ icon: Icon, label, value }) {
  return <div className="stat"><span className="stat-icon"><Icon size={16} /></span><span className="stat-value">{value}</span><span className="stat-label">{label}</span></div>;
}

function AppCard({ app, onOpen }) {
  const [copied, setCopied] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  useEffect(() => { setIconFailed(false); }, [app.iconUrl]);
  const patches = Array.isArray(app.patches) ? app.patches : [];
  const sourceCount = new Set(patches.map((patch) => patch.sourceName || patch.bundle).filter(Boolean)).size;
  const copyPackage = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(app.packageName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      const input = document.createElement("textarea");
      input.value = app.packageName;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    }
  };
  const status = app.googlePlayStatus || "unknown";
  return (
    <article className="app-card">
      <button className="app-card-main" type="button" onClick={() => onOpen(app)} aria-label={"View patches for " + app.name}>
        <span className="app-card-top">
          <Avatar src={!iconFailed ? app.iconUrl : null} name={app.name} className="app-avatar" />
          <span className="app-card-heading-copy">
            <span className="app-card-name">{app.name}</span>
            <span className="package-line">{app.packageName}</span>
          </span>
          <span className="card-arrow"><ArrowUpRight size={17} /></span>
        </span>
        <span className="app-card-info">
          <span className="app-card-description">Explore community patches and source details for this app.</span>
        </span>
      </button>
      <div className="app-card-meta">
        <span className="category-chip">{app.category || "Other"}</span>
        <span className="patch-count"><Sparkles size={13} /> {app.patchCount || patches.length} patches</span>
        {sourceCount > 0 && <span className="app-source-count"><Boxes size={13} /> {sourceCount} sources</span>}
      </div>
      <div className="app-card-actions">
        <button className="button button-quiet package-copy" type="button" onClick={copyPackage} title="Copy package name">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copied" : "Package ID"}</span>
        </button>
        {status === "available" ? (
          <a className="button button-quiet play-link" href={"https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.packageName)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            <Store size={14} /> Google Play <ArrowUpRight size={12} />
          </a>
        ) : status === "unavailable" ? (
          <span className="store-status unavailable" title="The listing was checked and not found on Google Play">Not on Play Store</span>
        ) : (
          <a className="store-status" href={"https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.packageName)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Check Play Store <ArrowUpRight size={12} /></a>
        )}
      </div>
    </article>
  );
}
function BundleCard({ bundle, onOpen }) {
  return (
    <article className="bundle-card">
      <button type="button" className="bundle-card-main" onClick={() => onOpen(bundle)}>
        <div className="bundle-card-top">
          <Avatar src={bundle.iconUrl} name={bundle.name} className="bundle-avatar" />
          <div className="bundle-card-flags">
            {bundle.isOfficial && <span className="official-badge"><ShieldCheck size={12} /> Official</span>}
            <span className="version-badge">v{String(bundle.version || "unknown").replace(/^v/, "")}</span>
          </div>
          <span className="card-arrow"><ArrowUpRight size={17} /></span>
        </div>
        <h3>{bundle.name}</h3>
        <p className="bundle-author">by {bundle.author || "Community maintainer"}</p>
        <p className="bundle-description">{bundle.description || "A community patch collection for supported Android apps."}</p>
      </button>
      <div className="bundle-card-meta">
        <span><Package size={14} /> {Number(bundle.patchCount || 0).toLocaleString()} patches</span>
        <span><Clock3 size={14} /> {relativeDate(bundle.updatedAt)}</span>
      </div>
      <div className="bundle-card-actions">
        <button className="button button-secondary" type="button" onClick={() => onOpen(bundle)}>Explore patches <ArrowRight size={14} /></button>
        <AddToReseam bundle={bundle} compact />
      </div>
    </article>
  );
}

function PatchCard({ patch, bundle }) {
  const [expanded, setExpanded] = useState(false);
  const packages = Array.isArray(patch.apps) ? patch.apps : [];
  const options = Array.isArray(patch.options) ? patch.options : [];
  return (
    <article className={"patch-card" + (expanded ? " is-expanded" : "")}>
      <button type="button" className="patch-card-summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="patch-symbol"><Sparkles size={17} /></span>
        <span className="patch-summary-copy">
          <strong>{patch.name}</strong>
          <span>{patch.description || "No description provided."}</span>
          <span className="patch-submeta">
            <code>{patch.id}</code>
            {packages.length > 0 && <span>{packages.length} target {packages.length === 1 ? "package" : "packages"}</span>}
            {options.length > 0 && <span>{options.length} configurable {options.length === 1 ? "option" : "options"}</span>}
          </span>
        </span>
        <ChevronDown size={17} className="patch-chevron" />
      </button>
      {expanded && (
        <div className="patch-expanded">
          {packages.length > 0 && (
            <div className="patch-info-block">
              <h4>Supported apps</h4>
              <div className="supported-packages">
                {packages.map((target, index) => (
                  <div className="supported-package" key={target.package + "-" + index}>
                    <code>{target.package}</code>
                    <span>{target.versions && target.versions.length ? target.versions.join(", ") : "Version not specified"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {options.length > 0 && (
            <div className="patch-info-block">
              <h4>Patch options</h4>
              <div className="option-list">
                {options.map((option) => (
                  <div className="option-row" key={option.key || option.title}>
                    <div><strong>{option.title || option.key}</strong>{option.description && <p>{option.description}</p>}</div>
                    <span className="option-type">{option.option_type || "option"}{option.required ? " · required" : ""}</span>
                    {option.default_value && <code className="option-default">Default: {String(option.default_value.value)}</code>}
                    {Array.isArray(option.valid_values) && option.valid_values.length > 0 && <span className="option-values">Allowed: {option.valid_values.join(", ")}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="patch-source-row">
            <span>Source: {patch.sourceName || bundle?.name || patch.bundle || "Community"}</span>
            {(patch.sourceUrl || bundle?.homepage) && <a href={patch.sourceUrl || bundle.homepage} target="_blank" rel="noreferrer">Source repository <ArrowUpRight size={13} /></a>}
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({ title, description, onReset }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Search size={21} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onReset && <button type="button" className="button button-secondary" onClick={onReset}>Clear filters</button>}
    </div>
  );
}

function Header({ tab, setTab, counts, onHome }) {
  const tabs = [
    { id: "apps", label: "Apps", icon: Smartphone, count: counts.apps },
    { id: "bundles", label: "Bundles", icon: Boxes, count: counts.bundles },
    { id: "news", label: "What’s New", icon: Clock3, count: null }
  ];
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" type="button" onClick={onHome} aria-label="Awesome Reseam home">
          <span className="brand-logo"><img src="/reseam.svg" alt="" /></span>
          <span className="brand-copy"><span><strong>Awesome</strong> Reseam</span><small>Explore community patches for Reseam</small></span>
        </button>
        <div className="header-actions">
          <a className="header-link" href="https://reseam.app/" target="_blank" rel="noreferrer"><span>Reseam</span><ArrowUpRight size={14} /></a>
          <a className="github-link" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository"><Github size={17} /><span>GitHub</span></a>
        </div>
      </div>
      <div className="nav-wrap">
        <nav className="main-tabs" aria-label="Main navigation" role="tablist">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button type="button" role="tab" aria-selected={tab === id} className={"main-tab" + (tab === id ? " active" : "")} key={id} onClick={() => setTab(id)}>
              <Icon size={16} /><span>{label}</span>{count !== null && <span className="tab-count">{count}</span>}
            </button>
          ))}
        </nav>
        <span className="header-note"><span className="status-dot" /> Community maintained</span>
      </div>
    </header>
  );
}

function AnimatedSelect({ icon: Icon, value, onChange, options, label, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  return (
    <div className={"animated-select-wrap " + className} ref={rootRef}>
      <button type="button" className={"select-control animated-select-trigger" + (open ? " is-open" : "")} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Icon size={15} />
        <span className="animated-select-value">{selected?.label || label}</span>
        <ChevronDown size={14} className="animated-select-chevron" />
      </button>
      <div className={"animated-select-menu" + (open ? " is-open" : "")} role="listbox" aria-label={label} aria-hidden={!open}>
        {options.map((option) => (
          <button type="button" role="option" aria-selected={value === option.value} className={"animated-select-option" + (value === option.value ? " selected" : "")} key={option.value} tabIndex={open ? 0 : -1} onClick={() => { onChange(option.value); setOpen(false); }}>
            <span>{option.label}</span>
            {value === option.value && <Check size={15} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchControl({ value, onChange, placeholder, onClear }) {
  return (
    <div className="search-control" onClick={(event) => {
      if (!event.target.closest("button")) event.currentTarget.querySelector("input")?.focus();
    }}>
      <Search size={17} aria-hidden="true" />
      <input className="search-input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <IconButton label="Clear search" onClick={onClear}><X size={15} /></IconButton>}
      {!value && <kbd>Ctrl K</kbd>}
    </div>
  );
}

function AppDetail({ app, catalog, query, setQuery, onBack }) {
  const [patchFilter, setPatchFilter] = useState("all");
  const patches = app.patches || [];
  const bundles = useMemo(() => {
    const groups = new Map();
    patches.forEach((patch) => {
      const source = getPatchBundle(catalog, patch);
      const key = source.indexUrl || source.name;
      if (!groups.has(key)) groups.set(key, { bundle: source, patches: [] });
      groups.get(key).patches.push(patch);
    });
    return Array.from(groups.values()).sort((a, b) => Number(!!b.bundle.isOfficial) - Number(!!a.bundle.isOfficial) || a.bundle.name.localeCompare(b.bundle.name));
  }, [app, catalog, patches]);
  const filteredGroups = bundles.map((group) => ({
    ...group,
    patches: group.patches.filter((patch) => {
      const matchesSearch = !normalizeText(query) || patchSearchText(patch).includes(normalizeText(query));
      const matchesType = patchFilter === "all" || (patchFilter === "configurable" ? (patch.options || []).length > 0 : (patch.options || []).length === 0);
      return matchesSearch && matchesType;
    })
  })).filter((group) => group.patches.length > 0);
  const totalFiltered = filteredGroups.reduce((sum, group) => sum + group.patches.length, 0);
  return (
    <section className="detail-page">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to apps</button>
      <div className="detail-hero">
        <Avatar src={app.iconUrl} name={app.name} className="detail-app-avatar" />
        <div className="detail-title-copy">
          <div className="eyebrow">{app.category || "Android app"}</div>
          <h1>{app.name}</h1>
          <div className="detail-package-row"><code>{app.packageName}</code><button type="button" className="text-action" onClick={async () => { try { await navigator.clipboard.writeText(app.packageName); } catch {} }}><Copy size={13} /> Copy ID</button></div>
          <p>Community-maintained patch information and supported app versions.</p>
          <div className="detail-stat-row">
            <span><Sparkles size={14} /> {app.patchCount || patches.length} patches</span>
            <span><Boxes size={14} /> {app.bundleCount || new Set(patches.map((patch) => patch.bundle)).size} sources</span>
            {app.googlePlayStatus === "available" && <a href={"https://play.google.com/store/apps/details?id=" + encodeURIComponent(app.packageName)} target="_blank" rel="noreferrer"><Store size={14} /> Google Play <ArrowUpRight size={12} /></a>}
          </div>
        </div>
      </div>
      <div className="detail-toolbar">
        <div><h2>Bundles and patches</h2><p>{totalFiltered} matching patches in {filteredGroups.length} sources</p></div>
        <label className="select-control compact-select"><Filter size={15} /><select value={patchFilter} onChange={(event) => setPatchFilter(event.target.value)} aria-label="Filter patches"><option value="all">All patches</option><option value="configurable">With options</option><option value="simple">No options</option></select><ChevronDown size={14} /></label>
      </div>
      <SearchControl value={query} onChange={setQuery} placeholder="Filter this app’s patches…" onClear={() => setQuery("")} />
      {filteredGroups.length === 0 ? <EmptyState title="No patches found" description="Try a different search or filter." onReset={() => { setQuery(""); setPatchFilter("all"); }} /> : (
        <div className="app-bundle-list">
          {filteredGroups.map((group) => (
            <section className="app-bundle-group" key={group.bundle.indexUrl || group.bundle.name}>
              <div className="app-bundle-heading">
                <Avatar src={group.bundle.iconUrl} name={group.bundle.name} className="bundle-mini-avatar" />
                <div className="app-bundle-heading-copy"><strong>{group.bundle.name}</strong><span>{group.bundle.author} · {group.bundle.version ? "v" + String(group.bundle.version).replace(/^v/, "") : "Community source"}</span></div>
                {group.bundle.isOfficial && <span className="official-badge"><ShieldCheck size={12} /> Official</span>}
                <AddToReseam bundle={group.bundle} compact />
              </div>
              <div className="patch-list">{group.patches.map((patch) => <PatchCard patch={patch} bundle={group.bundle} key={patch.id} />)}</div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function BundleDetail({ bundle, catalog, query, setQuery, onBack }) {
  const [pageSize, setPageSize] = useState(30);
  const patches = useMemo(() => getBundlePatches(catalog, bundle), [catalog, bundle]);
  const filteredPatches = useMemo(() => patches.filter((patch) => !normalizeText(query) || patchSearchText(patch).includes(normalizeText(query))), [patches, query]);
  useEffect(() => setPageSize(30), [bundle, query]);
  return (
    <section className="detail-page">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to bundles</button>
      <div className="detail-hero bundle-detail-hero">
        <Avatar src={bundle.iconUrl} name={bundle.name} className="detail-app-avatar" />
        <div className="detail-title-copy">
          <div className="eyebrow">{bundle.isOfficial ? "Official source" : "Community source"}</div>
          <h1>{bundle.name}</h1>
          <p className="detail-author">Maintained by {bundle.author || "the community"}</p>
          <p>{bundle.description || "A collection of Reseam patches for Android apps."}</p>
          <div className="detail-stat-row"><span><Package size={14} /> {(bundle.patchCount || patches.length).toLocaleString()} patches</span><span><Clock3 size={14} /> {relativeDate(bundle.updatedAt)}</span><span>Version {bundle.version || "not listed"}</span></div>
          <div className="detail-primary-actions"><AddToReseam bundle={bundle} />{bundle.homepage && <a className="button button-secondary" href={bundle.homepage} target="_blank" rel="noreferrer"><Github size={15} /> Source repository <ArrowUpRight size={13} /></a>}</div>
        </div>
      </div>
      <div className="detail-toolbar"><div><h2>Patch directory</h2><p>{filteredPatches.length.toLocaleString()} patches match your search</p></div></div>
      <SearchControl value={query} onChange={setQuery} placeholder="Filter patches in this bundle…" onClear={() => setQuery("")} />
      {filteredPatches.length === 0 ? <EmptyState title="No patches found" description="Try another patch name, package ID, or keyword." onReset={() => setQuery("")} /> : (
        <>
          <div className="patch-list">{filteredPatches.slice(0, pageSize).map((patch) => <PatchCard patch={patch} bundle={bundle} key={patch.id} />)}</div>
          {filteredPatches.length > pageSize && <div className="load-more"><button className="button button-secondary" type="button" onClick={() => setPageSize((value) => value + 30)}>Show more patches <ArrowDownUp size={14} /></button><span>Showing {Math.min(pageSize, filteredPatches.length)} of {filteredPatches.length}</span></div>}
        </>
      )}
    </section>
  );
}

function UpdateCard({ update }) {
  const [expanded, setExpanded] = useState(false);
  const text = String(update.description || "").trim();
  return (
    <article className="update-card">
      <div className="update-marker"><Clock3 size={16} /></div>
      <div className="update-content">
        <div className="update-headline"><div><span className="update-source">{update.sourceName || "Patch source"}</span><h3>{update.version ? "Version " + update.version : "Source update"}</h3></div><time dateTime={update.createdAt || undefined}>{formatDate(update.createdAt)}</time></div>
        {text ? <p className={"update-description" + (!expanded && text.length > 230 ? " clipped" : "")}>{text}</p> : <p className="update-description muted">No release description was provided.</p>}
        {text.length > 230 && <button type="button" className="text-action" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show less" : "Read release notes"} <ChevronDown size={13} className={expanded ? "rotate-180" : ""} /></button>}
        {update.sourceUrl && <a className="update-source-link" href={update.sourceUrl} target="_blank" rel="noreferrer">View source <ArrowUpRight size={13} /></a>}
      </div>
    </article>
  );
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTabState] = useState("apps");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("popular");
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [pageSize, setPageSize] = useState(24);
  const [sortOpen, setSortOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setTab = useCallback((nextTab) => {
    setTabState(nextTab);
    setSelectedApp(null);
    setSelectedBundle(null);
    setQuery("");
    setCategory("all");
    setPageSize(24);
    setSortOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    url.searchParams.delete("bundle");
    window.history.replaceState({}, "", url);
  }, []);

  const openApp = useCallback((app) => {
    setSelectedApp(app);
    setSelectedBundle(null);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("app", app.packageName);
    url.searchParams.delete("bundle");
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openBundle = useCallback((bundle) => {
    setSelectedBundle(bundle);
    setSelectedApp(null);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.set("bundle", bundle.name);
    url.searchParams.delete("app");
    window.history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goBack = useCallback(() => {
    setSelectedApp(null);
    setSelectedBundle(null);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    url.searchParams.delete("bundle");
    window.history.replaceState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const refreshCatalog = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/catalog?refresh=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Live catalog refresh failed");
      const next = await response.json();
      if (!next?.registry?.available || !Array.isArray(next.apps) || !Array.isArray(next.bundles)) {
        throw new Error("The registry returned an invalid catalog");
      }
      setCatalog(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const validCatalog = (data) =>
      data && Array.isArray(data.apps) && Array.isArray(data.bundles) && Array.isArray(data.whatsNew);

    const loadCatalog = async () => {
      // Render the bundled snapshot first; never make the first screen wait for the live registry.
      let hasSnapshot = false;
      try {
        const response = await fetch("/catalog.json");
        if (!response.ok) throw new Error("Saved catalog unavailable");
        const snapshot = await response.json();
        if (!validCatalog(snapshot)) throw new Error("Saved catalog is invalid");
        if (cancelled) return;
        setCatalog(snapshot);
        setLoadError(false);
        hasSnapshot = true;
      } catch {
        // Continue to the live endpoint if the static snapshot cannot be read.
      }

      // Refresh in the background. The page remains usable while the registry warms up.
      try {
        const response = await fetch("/api/catalog");
        if (!response.ok) throw new Error("Live catalog unavailable");
        const live = await response.json();
        if (!live?.registry?.available || !validCatalog(live)) throw new Error("Live catalog response was invalid");
        if (!cancelled) {
          setCatalog(live);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) {
          if (!hasSnapshot) setCatalog(EMPTY_CATALOG);
          setLoadError(true);
        }
      }
    };

    void loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector(".search-input")?.focus();
      }
      if (event.key === "Escape") {
        setSortOpen(false);
        if (selectedApp || selectedBundle) goBack();
        else setQuery("");
      }
    };
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const appName = url.searchParams.get("app");
      const bundleName = url.searchParams.get("bundle");
      if (catalog && appName) {
        setSelectedApp(catalog.apps.find((app) => app.packageName === appName) || null);
        setSelectedBundle(null);
      } else if (catalog && bundleName) {
        setSelectedBundle(catalog.bundles.find((bundle) => bundle.name === bundleName) || null);
        setSelectedApp(null);
      } else {
        setSelectedApp(null);
        setSelectedBundle(null);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("popstate", handlePopState);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [catalog, goBack, selectedApp, selectedBundle]);

  useEffect(() => {
    if (!catalog) return;
    const url = new URL(window.location.href);
    const appParam = url.searchParams.get("app");
    const bundleParam = url.searchParams.get("bundle");
    if (appParam) {
      const app = catalog.apps.find((item) => item.packageName === appParam);
      if (app) { setSelectedApp(app); setSelectedBundle(null); setTabState("apps"); }
    } else if (bundleParam) {
      const bundle = catalog.bundles.find((item) => item.name === bundleParam);
      if (bundle) { setSelectedBundle(bundle); setSelectedApp(null); setTabState("bundles"); }
    }
  }, [catalog]);

  const categories = useMemo(() => Array.from(new Set((catalog?.apps || []).map((app) => app.category || "Other"))).sort((a, b) => a.localeCompare(b)), [catalog]);
  const totalPatches = useMemo(() => {
    if (Number.isFinite(Number(catalog?.registry?.currentReseamPatchCount))) return Number(catalog.registry.currentReseamPatchCount);
    return (catalog?.bundles || []).reduce((sum, bundle) => sum + Number(bundle.patchCount || 0), 0);
  }, [catalog]);
  const visibleApps = useMemo(() => {
    return (catalog?.apps || []).filter((app) => {
      if (category !== "all" && app.category !== category) return false;
      if (!normalizeText(query)) return true;
      const patchText = (app.patches || []).map(patchSearchText).join(" ");
      return normalizeText([app.name, app.packageName, app.category, patchText].join(" ")).includes(normalizeText(query));
    }).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "patches-asc" ? Number(a.patchCount || 0) - Number(b.patchCount || 0) : Number(b.patchCount || 0) - Number(a.patchCount || 0) || a.name.localeCompare(b.name));
  }, [catalog, category, query, sort]);

  const visibleBundles = useMemo(() => {
    return (catalog?.bundles || []).filter((bundle) =>
      normalizeText([bundle.name, bundle.author, bundle.description, bundle.version, bundle.homepage].join(" ")).includes(normalizeText(query))
    ).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "patches-asc" ? Number(a.patchCount || 0) - Number(b.patchCount || 0) : Number(b.patchCount || 0) - Number(a.patchCount || 0));
  }, [catalog, query, sort]);

  const visibleUpdates = useMemo(() => {
    return (catalog?.whatsNew || []).filter((item) =>
      normalizeText([item.version, item.sourceName, item.description].join(" ")).includes(normalizeText(query))
    ).sort((a, b) => sort === "oldest" ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [catalog, query, sort]);

  useEffect(() => { setPageSize(24); }, [query, category, sort, tab]);

  const counts = {
    apps: (catalog?.apps || []).length,
    bundles: (catalog?.bundles || []).length
  };

  return (
    <div className="site-shell">
      <Header tab={selectedApp ? "apps" : selectedBundle ? "bundles" : tab} setTab={setTab} counts={counts} onHome={() => setTab("apps")} />
      <main className="main-content">
        {!selectedApp && !selectedBundle && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <div className="hero-kicker"><span className="hero-kicker-dot" /> COMMUNITY PATCH DIRECTORY</div>
                <h1>Make your apps <span>more yours.</span></h1>
                <p>Discover community-made patches, explore what they change, and add compatible sources to Reseam.</p>
                <div className="hero-links"><a href="https://reseam.app/patches/" target="_blank" rel="noreferrer">Official patch directory <ArrowUpRight size={14} /></a><span className="hero-separator" /><span>{catalog?.registry?.available ? "Live registry · " + Number(catalog.registry.currentReseamPatchCount || totalPatches).toLocaleString() + " current patches" : "Saved catalog · " + formatDate(catalog?.generatedAt)}</span></div>
              </div>
              <div className="hero-stats">
                <Stat icon={Smartphone} label="Patchable apps" value={counts.apps.toLocaleString()} />
                <Stat icon={Boxes} label="Patch sources" value={counts.bundles.toLocaleString()} />
                <Stat icon={Sparkles} label="Listed patches" value={totalPatches.toLocaleString()} />
              </div>
            </section>
            <section className="catalog-section">
              <div className="catalog-heading">
                <div><span className="eyebrow">{tab === "apps" ? "EXPLORE THE DIRECTORY" : tab === "bundles" ? "COMMUNITY COLLECTIONS" : "LATEST ACTIVITY"}</span><h2>{tab === "apps" ? "Find an app" : tab === "bundles" ? "Browse patch sources" : "What’s New"}</h2><p>{tab === "apps" ? "Search apps, inspect available patches, and check supported versions." : tab === "bundles" ? "Explore maintained collections and add their source directly to Reseam." : "Release notes collected from official and community patch bundles."}</p></div>
                <button className="button button-secondary refresh-button" type="button" onClick={refreshCatalog} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing…" : "Refresh catalog"}</button>
              </div>
              {loadError && <div className="notice notice-warning"><CircleHelp size={17} /><div><strong>Live registry temporarily unavailable</strong><span>Keeping the last loaded catalog for now. Try refreshing again shortly.</span></div><button type="button" className="notice-action" onClick={refreshCatalog}>Try again</button></div>}
              {(catalog?.staleSources || []).length > 0 && <div className="notice notice-warning"><CircleHelp size={17} /><div><strong>Some sources could not be refreshed</strong><span>Showing last saved source data. Check source details for errors.</span></div><details><summary>Details</summary>{catalog.staleSources.map((source) => <p key={source.url}>{source.name}: {source.error}</p>)}</details></div>}
              <div className="catalog-controls">
                <SearchControl value={query} onChange={setQuery} placeholder={tab === "apps" ? "Search apps or patches…" : tab === "bundles" ? "Search bundles…" : "Search release notes…"} onClear={() => setQuery("")} />
                <div className="filter-controls">
                  {tab === "apps" && <AnimatedSelect icon={ListFilter} label="Filter apps by category" value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((item) => ({ value: item, label: item }))]} />}
                  <AnimatedSelect icon={ArrowDownAZ} label="Sort results" value={tab === "news" ? (sort === "oldest" ? "oldest" : "popular") : sort} onChange={setSort} options={tab === "news" ? [{ value: "popular", label: "Newest releases" }, { value: "oldest", label: "Oldest releases" }] : [{ value: "popular", label: "Most patches" }, { value: "name", label: "Name A–Z" }, { value: "patches-asc", label: "Fewest patches" }]} />
                </div>
              </div>
              <div className="results-summary"><span>{tab === "apps" ? "PATCHABLE APPS" : tab === "bundles" ? "PATCH SOURCES" : "RELEASE NOTES"}</span><div><strong>{(tab === "apps" ? visibleApps.length : tab === "bundles" ? visibleBundles.length : visibleUpdates.length).toLocaleString()}</strong> results <span className="results-divider">·</span> Checked {formatDate(catalog?.fetchedAt || catalog?.generatedAt)}</div></div>
              {tab === "apps" && (
                visibleApps.length ? <>
                  <div className="app-grid" key={`${tab}-${category}-${sort}`}>{visibleApps.slice(0, pageSize).map((app) => <AppCard key={app.packageName} app={app} onOpen={openApp} />)}</div>
                  {visibleApps.length > pageSize && <div className="load-more"><button className="button button-secondary" type="button" onClick={() => setPageSize((value) => value + 24)}>Show more apps <ArrowRight size={14} /></button><span>Showing {Math.min(pageSize, visibleApps.length)} of {visibleApps.length}</span></div>}
                </> : <EmptyState title="No apps match your search" description="Try another keyword or clear your category filter." onReset={() => { setQuery(""); setCategory("all"); }} />
              )}
              {tab === "bundles" && (
                visibleBundles.length ? <div className="bundle-grid">{visibleBundles.map((bundle) => <BundleCard key={bundle.name} bundle={bundle} onOpen={openBundle} />)}</div> : <EmptyState title="No patch sources found" description="Try searching by a source name or maintainer." onReset={() => setQuery("")} />
              )}
              {tab === "news" && (
                visibleUpdates.length ? <div className="updates-list">{visibleUpdates.slice(0, pageSize).map((update, index) => <UpdateCard key={(update.sourceUrl || update.sourceName || "source") + "-" + update.version + "-" + update.createdAt + "-" + index} update={update} />)}</div> : <EmptyState title="No release notes found" description="Try a different search term." onReset={() => setQuery("")} />
              )}
              {tab === "news" && visibleUpdates.length > pageSize && <div className="load-more"><button className="button button-secondary" type="button" onClick={() => setPageSize((value) => value + 24)}>Show more updates <ArrowRight size={14} /></button><span>Showing {Math.min(pageSize, visibleUpdates.length)} of {visibleUpdates.length}</span></div>}
              <div className="directory-disclaimer"><ShieldCheck size={16} /><span>Community-maintained catalog. Always review patch descriptions and source information before installing.</span><a href="https://reseam.app/" target="_blank" rel="noreferrer">About Reseam <ArrowUpRight size={12} /></a></div>
            </section>
          </>
        )}
        {selectedApp && catalog && <AppDetail app={selectedApp} catalog={catalog} query={query} setQuery={setQuery} onBack={goBack} />}
        {selectedBundle && catalog && <BundleDetail bundle={selectedBundle} catalog={catalog} query={query} setQuery={setQuery} onBack={goBack} />}
        {!catalog && <div className="loading-state"><LoaderCircle size={24} className="spin" /><strong>Loading patch catalog</strong><span>Fetching saved app and bundle information…</span></div>}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <button className="footer-brand" type="button" onClick={() => setTab("apps")}><span className="brand-logo small"><img src="/reseam.svg" alt="" /></span><span>Awesome Reseam</span></button>
          <span className="footer-legal">Community maintained · Not affiliated with Reseam</span>
          <div className="footer-links"><a href="https://reseam.app/" target="_blank" rel="noreferrer">Reseam <ArrowUpRight size={12} /></a><a href="https://patch-bundles.api.jmancentral.com/" target="_blank" rel="noreferrer">Patch registry <ArrowUpRight size={12} /></a><a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={12} /></a></div>
        </div>
        <div className="footer-bottom"><span>Built for patch discovery.</span><span>Catalog fetched {formatDate(catalog?.fetchedAt || catalog?.generatedAt)}</span></div>
      </footer>
    </div>
  );
}
