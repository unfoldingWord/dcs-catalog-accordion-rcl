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

There is **no test runner** configured in this repo. "Tests" here means Storybook stories; there is no `pnpm test` script.

## Versions & tooling

- **pnpm 11** and **Node 22** (what CI uses; `pnpm-workspace.yaml` holds pnpm settings — the `allowBuilds:` key and a `valibot` override for `@storybook/addon-mcp` — and pnpm 9 errors on that file).
- **React 18 only** (peer dependency `^18`) — see the consumption constraint below.
- **MUI v9**, **Storybook 10** (`@storybook/react-vite`; controls/actions/interactions live in Storybook core — the only addons are links, docs, chromatic, and mcp), **Vite 5**, **ESLint 8** (classic `.eslintrc.cjs`, not flat config).

## Architecture

This is a **publishable React component library** (`dcs-catalog-accordion-rcl`), not an app. Vite is configured in library mode (`vite.config.js`): `src/index.js` is the entry, `react`/`react-dom` are externalized (and declared as `peerDependencies`), and output is minified UMD + ES bundles named `dcs-map-and-accordion.{format}.js`. The npm package ships only `dist/` (`files` field). `src/main.jsx` / `src/App.jsx` exist only as a local dev harness and are **not** part of the published library.

**Consumption constraint (do not break):** the primary consumer is `openbiblestories.org/library`, which loads the **UMD** bundle pinned by exact version from unpkg via a plain `<script>` tag alongside React 18 UMD globals from a CDN (production builds, matching react/react-dom versions). React **must stay on 18.x** — React 19 dropped UMD builds entirely, which would break this static-page embedding. Dependencies are therefore pinned to React-18-compatible versions (MUI v9 still declares a React 18 peer).

Two components are exported from `src/index.js`:

### `DcsCatalogAccordion` (`src/components/DcsCatalogAccordion.jsx`)
The core component (~1000 lines). It renders a **lazily-loaded, four-level nested accordion** of the DCS (Door43 Content Service) catalog. Each level fetches its children only when expanded, building up a single `accordionMap` state tree keyed `language → owner → repo (full_name) → entries`:

1. **Languages** — fetched on mount from `catalog/list/languages`.
2. **Owners** — fetched on language expand from `catalog/list/owners`.
3. **Top catalog entries** — fetched on owner expand from `catalog/search` (latest release per repo).
4. **Downloadable versions/formats** — fetched on entry expand from `catalog/search?...&includeHistory=1`, then per-asset metadata is assembled into `DownloadableTypes` (`text`/`audio`/`video`/`other`) via the `Format`/`Chapter` helper classes near the top of the file.

Key cross-cutting details:
- API base is `dcsURL` (default `https://git.door43.org`) + `API_PATH` (`api/v1`). All requests go through `axios` and `buildQueryString`.
- **Expansion is controlled state:** every Accordion is controlled by the `expandedIds` Set (ids follow the `lang--owner--repo--version` DOM-id scheme). `handleAccordionToggle` is the single onChange handler and writes the URL hash on manual expansion; one effect fetches whatever an expanded level still needs (`fetchesInFlightRef` guards duplicates), so expansion — user click or deep link — is the only trigger for data loading. Never expand accordions by dispatching DOM clicks on MUI internals (MUI v6+ wraps `AccordionSummary` in a heading element, which silently breaks `firstElementChild.click()`); add ids to `expandedIds` instead.
- **Deep linking:** the URL hash (`lang--owner--repo--version`) is read on load and on `hashchange` into `accordionIdToShowRef` (state mirror `accordionIdToShow` triggers effects). An effect pre-expands every level of the target id, waits for each level's data to arrive, then scrolls to the deepest level that exists and clears the target — also when the fetched data proves the target absent, so it can't wait forever.
- **DOM size:** collapsed accordion details are unmounted (`slotProps` transition `unmountOnExit` via `ACCORDION_SLOT_PROPS`), so only expanded subtrees exist in the DOM (~200 collapsed languages are just summary rows).
- **Language-code casing (subtle):** the DCS catalog endpoints are **case-sensitive** on the `lang` query param, but `catalog/list/languages` returns canonical mixed-case codes (e.g. `ur-Deva`) while search results return lowercase (`ur-deva`). So API queries must lowercase the code (`lc.toLowerCase()`), but the `accordionMap` tree and DOM ids must stay keyed by the original mixed-case `lc` (passed down explicitly to the owner/entry/downloadable handlers — do **not** key off the API's lowercase `.language` field, or nesting and deep-links break). Also note empty results come back as `{"data": null}`, not `[]` — always null-guard `response.data.data`.
- File-type/format logic lives in standalone helpers (`getFileExt`, `getFormatFromName`, `getDescription`, `getSize`, `add*ToDownloadableTypes`) above the component, mapping extensions/URLs to MIME-ish format strings and MUI icons. `DownloadableFormatList` renders one downloadable-type list (with the per-chapter expander) and is shared by the version cards and the resource card.
- **Resource card quick links:** the repo-level card lists the newest PDF first (from the top entry's release, falling back to the newest version whose text downloads contain exactly one PDF), then surfaces the newest Audio and Video sets from whichever version has them — users shouldn't have to open version accordions to find the primary downloads.

Props are `languages`, `owners`, `subjects`, `stage`, `dcsURL` (base host only — `API_PATH` is appended internally); the README documents them.

### `WorldLanguageMap` (`src/components/WorldLanguageMap.jsx`)
An interactive SVG world map. Continent styling and region mapping come from `src/data/map.js`; `src/data/regions.js` maps a region to its list of language codes. It attaches raw DOM `click`/`mouseenter`/`mouseleave` listeners to the `#world-map` SVG (not React handlers) and calls `onContinentClick(languageCodes)` so a parent can drive `DcsCatalogAccordion`'s `languages` prop — this is exactly how `src/App.jsx` wires them together.

## Build/deploy notes

- `vite-plugin-static-copy` copies `index-build.html` → `dist/index.html` at build time, so the published `dist/` ships a standalone demo page alongside the library bundles. The page must load pinned, matching **production** React 18 UMDs — unpinned `unpkg.com/react/umd/...` URLs now resolve to React 19 and 404.
- **npm publishing is automated:** create a GitHub release tagged `vX.Y.Z` (matching package.json's version) and `.github/workflows/npm-publish.yml` builds and publishes with the org's `NPM_TOKEN` secret; it skips if the version is already on the registry. After publishing, the exact-version unpkg pin on consuming pages (openbiblestories.org/library) must be bumped by hand.
- Deployed via Netlify (`netlify.toml`): `pnpm build`, publish `dist`.
- `storybook-static/` is build output — gitignored and ESLint-ignored; never commit it.
