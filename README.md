# Awesome Reseam

A community directory for discovering Reseam-compatible Android patch bundles, supported apps, individual patches, and release notes.

**Live website:** https://awesome-reseam.vercel.app/  
**Source repository:** https://github.com/visionxstream99-mod/Awesome-reseam

## Project status

The production website was recovered from its deployed assets because the original editable source tree was not available in the connected GitHub account. This repository preserves the working runtime, styles, catalog snapshot, manifest, service worker, and Vite configuration.

The Vercel project is linked to this repository. The production branch is `main`; pushes should trigger deployments automatically. Check the Vercel project’s Deployments tab if a commit does not appear online.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Create and preview a production build:

```bash
npm run build
npm run preview
```

## Included features

- App directory with search, category filtering, and sorting.
- Bundle catalog with source links and add-to-Reseam actions.
- Per-app patch details and patch options.
- What's New / release history.
- Local catalog snapshot at `public/catalog.json`.
- Offline-friendly service-worker caching.
- Production runtime assets recovered from the live website.

## Updating the catalog

The checked-in catalog is a recovery snapshot, not a guarantee that every listed app or bundle is still the latest. Refresh and validate the catalog against the current upstream index before publishing changes.

## Attribution

Catalog contents are collected from the official Reseam patch index and community bundle metadata. Individual bundle owners remain responsible for their patches. Awesome Reseam is a community directory and is not affiliated with Reseam.
