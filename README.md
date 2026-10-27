# Awesome Reseam

A community directory for discovering Reseam-compatible Android patch bundles, supported apps, individual patches, and release notes.

## Reconstructed project

The original editable source tree was not available in the connected GitHub account. This repository has been restored from the working production deployment of [awesome-reseam.vercel.app](https://awesome-reseam.vercel.app/): the shipped application bundle, styling, catalog snapshot, manifest, and service worker were recovered so the website remains functional.

The current runtime is a Vite-served production snapshot. Keep the recovered bundle files in sync when changing the UI; a readable source migration can be done incrementally without losing the working deployment.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## What's included

- App directory with search, category filtering, and sorting.
- Bundle catalog with source links and add-to-Reseam actions.
- Per-app patch details and patch options.
- What's New / release history.
- Local catalog snapshot at `public/catalog.json`, plus a service-worker cache for offline-friendly loading.
- Production runtime assets recovered from the live deployment.

## Data and attribution

Catalog contents are collected from the official Reseam patch index and community bundle metadata. Individual bundle owners remain responsible for their patches. Awesome Reseam is a community directory and is not affiliated with Reseam.

The included catalog is a recovery snapshot from 2026-10-25. Refresh it from the live catalog before making claims about latest versions.
