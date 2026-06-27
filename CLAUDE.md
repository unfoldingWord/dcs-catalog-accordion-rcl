# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (a `pnpm-workspace.yaml` exists, but this is a single-package repo).

- `pnpm dev` — start the Vite dev server (renders `src/App.jsx`, the demo wiring both components together).
- `pnpm build` — build the distributable library to `dist/` (UMD + ES). Also runs the Netlify build.
- `pnpm lint` — ESLint over `js,jsx`; configured with `--max-warnings 0`, so any warning fails.
- `pnpm preview` — serve the production build.
- `pnpm storybook` — run Storybook on port 6006.
- `pnpm build-storybook` — build the static Storybook.

There is **no test runner** configured in this repo. "Tests" here means Storybook stories plus `@storybook/test`; there is no `pnpm test` script.

## Architecture

This is a **publishable React component library** (`dcs-catalog-accordion-rcl`), not an app. Vite is configured in library mode (`vite.config.js`): `src/index.js` is the entry, `react`/`react-dom` are externalized, and output is unminified UMD + ES bundles named `dcs-map-and-accordion.{format}.js`. `src/main.jsx` / `src/App.jsx` exist only as a local dev harness and are **not** part of the published library.

**Consumption constraint (do not break):** the primary consumer is `openbiblestories.org/library`, which loads the **UMD** bundle via a plain `<script>` tag alongside React 18 UMD globals from a CDN. React **must stay on 18.x** — React 19 dropped UMD builds entirely, which would break this static-page embedding. Dependencies are therefore pinned to React-18-compatible versions (MUI v9 still declares a React 18 peer).

Two components are exported from `src/index.js`:

### `DcsCatalogAccordion` (`src/components/DcsCatalogAccordion.jsx`)
The core component (~1000 lines). It renders a **lazily-loaded, four-level nested accordion** of the DCS (Door43 Content Service) catalog. Each level fetches its children only when expanded, building up a single `accordionMap` state tree keyed `language → owner → repo (full_name) → entries`:

1. **Languages** — fetched on mount from `catalog/list/languages`.
2. **Owners** — fetched on language expand from `catalog/list/owners`.
3. **Top catalog entries** — fetched on owner expand from `catalog/search` (latest release per repo).
4. **Downloadable versions/formats** — fetched on entry expand from `catalog/search?...&includeHistory=1`, then per-asset metadata is assembled into `DownloadableTypes` (`text`/`audio`/`video`/`other`) via the `Format`/`Chapter` helper classes near the top of the file.

Key cross-cutting details:
- API base is `dcsURL` (default `https://git.door43.org`) + `API_PATH` (`api/v1`). All requests go through `axios` and `buildQueryString`.
- **Deep linking:** the URL hash is parsed as `lang--owner--repo--version` into `accordionIdToShow`. On load the component auto-expands and walks down the tree to that entry, polling with `setInterval` until the target accordion renders.
- **Language-code casing (subtle):** the DCS catalog endpoints are **case-sensitive** on the `lang` query param, but `catalog/list/languages` returns canonical mixed-case codes (e.g. `ur-Deva`) while search results return lowercase (`ur-deva`). So API queries must lowercase the code (`lc.toLowerCase()`), but the `accordionMap` tree and DOM ids must stay keyed by the original mixed-case `lc` (passed down explicitly to the owner/entry/downloadable handlers — do **not** key off the API's lowercase `.language` field, or nesting and deep-links break). Also note empty results come back as `{"data": null}`, not `[]` — always null-guard `response.data.data`.
- File-type/format logic lives in standalone helpers (`getFileExt`, `getFormatFromName`, `getDescription`, `getSize`, `add*ToDownloadableTypes`) above the component, mapping extensions/URLs to MIME-ish format strings and MUI icons.

**Prop-name gotcha:** the README documents a `dcsApiUrl` prop that includes `/api/v1`, but the actual prop is **`dcsURL`** (base host only — `API_PATH` is appended internally). Trust the code/`propTypes` (`languages`, `owners`, `subjects`, `stage`, `dcsURL`) over the README.

### `WorldLanguageMap` (`src/components/WorldLanguageMap.jsx`)
An interactive SVG world map. Continent styling and region mapping come from `src/data/map.js`; `src/data/regions.js` maps a region to its list of language codes. It attaches raw DOM `click`/`mouseenter`/`mouseleave` listeners to the `#world-map` SVG (not React handlers) and calls `onContinentClick(languageCodes)` so a parent can drive `DcsCatalogAccordion`'s `languages` prop — this is exactly how `src/App.jsx` wires them together.

## Build/deploy notes

- `vite-plugin-static-copy` copies `index-build.html` → `dist/index.html` and `index-obs.html` → `dist/obs.html` at build time, so the published `dist/` ships standalone demo pages alongside the library bundles.
- Deployed via Netlify (`netlify.toml`): `pnpm build`, publish `dist`.
