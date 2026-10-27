# Awesome Reseam

A community directory for discovering Reseam-compatible Android patch bundles, supported apps, individual patches, and release notes.

**Live website:** https://awesome-reseam.vercel.app/  
**Source repository:** https://github.com/visionxstream99-mod/Awesome-reseam

## Stack

- React 19 for reusable UI components and interactive detail views.
- Vite for local development and optimized production builds.
- Lucide React for interface icons.
- A checked-in JSON catalog at \`public/catalog.json\`.
- A service worker for cached catalog access and offline-friendly page loading.

## Local development

Requires Node.js 20 or newer.

\`\`\`bash
npm install
npm run dev
\`\`\`

Create and preview a production build:

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Features

- App directory with search across app names, package IDs, and patch metadata.
- Category filtering and sorting by patch count or app name.
- Bundle directory with official/community markers, versions, and source links.
- App and bundle detail pages with patch descriptions, package compatibility, version information, and configurable options.
- “Add to Reseam” links for supported patch sources.
- Copyable Android package IDs and Google Play links/status.
- “What’s New” release history with search and expandable notes.
- Keyboard shortcut \`Ctrl+K\` / \`Cmd+K\` to focus search.
- Responsive mobile/desktop layouts.
- Query links for sharing app and bundle detail views.
- Cached catalog fallback and an in-page refresh action.

## Project structure

- \`src/main.jsx\` — React entry point.
- \`src/App.jsx\` — navigation, app/bundle cards, search, detail pages, patch option rendering, and release notes.
- \`src/styles.css\` — responsive dark theme and component styles.
- \`public/catalog.json\` — catalog snapshot used by the directory.
- \`public/sw.js\` — service worker for shell and catalog caching.
- \`public/reseam.svg\` — Reseam logo asset.
- \`index.html\` — Vite document entry point.

## Catalog freshness

The checked-in catalog is a recovery snapshot, not a guarantee that every listed app or bundle is still the latest. Refresh the catalog source and validate its contents before publishing a refreshed snapshot. “Refresh catalog” attempts a network reload of the saved catalog URL; it does not generate a new catalog itself.

## Attribution

Catalog contents are collected from the official Reseam patch index and community bundle metadata. Individual bundle owners remain responsible for their patches. Awesome Reseam is a community directory and is not affiliated with Reseam.

## Deployment

The Vercel project is connected to this repository and deploys pushes to \`main\`. Every source change should be tested with \`npm run build\` before it is merged or deployed.
