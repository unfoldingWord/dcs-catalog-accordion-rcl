# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (a `pnpm-workspace.yaml` exists, but this is a single-package repo).

- `pnpm dev` — start the Vite dev server (renders `src/App.jsx`, a demo with a mode switcher covering every component combination; supports `?subject=&language=&owner=&stage=&server=&demo=` URL params, defaulting to the **QA server** — use `?server=PROD` for git.door43.org).
- `pnpm build` — build the distributable library to `dist/` (UMD + ES).
- `pnpm build:demo` — build the dev sandbox as a standalone site to `dist-demo/` (`vite.demo.config.js`); requires `pnpm build` first (it copies the UMD bundle in). This is what Netlify serves.
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

Shared API constants/helpers (`buildQueryString`, `mediaTypeParams`, `MEDIA_TYPE_OPTIONS`, `DEFAULT_DCS_URL`, `API_PATH`, `DEFAULT_STAGE`) live in `src/lib/dcsApi.js`. Four components are exported from `src/index.js`:

### `DcsCatalogAccordion` (`src/components/DcsCatalogAccordion.jsx`)
The core component (~1000 lines). It renders a **lazily-loaded, three-level nested accordion** (language → owner → resource) of the DCS (Door43 Content Service) catalog, with per-type download sections inside each resource card. Each level fetches its children only when expanded, building up a single `accordionMap` state tree keyed `language → owner → repo (full_name) → entries`:

1. **Languages** — fetched on mount from `catalog/list/languages`.
2. **Owners** — fetched on language expand from `catalog/list/owners`.
3. **Top catalog entries** — fetched on owner expand from `catalog/search` (latest release per repo).
4. **Downloadable versions/formats** — fetched on entry expand from `catalog/search?...&includeHistory=1` (per-repo query), then per-asset metadata is assembled into `DownloadableTypes` (`text`/`audio`/`video`/`other`) via the `Format`/`Chapter` helper classes near the top of the file. Versions are not shown individually: `getLatestDownloadableTypes` merges each type across versions (newest wins per prefix/extension/quality signature; nothing is dropped within a single version) and the resource card renders one collapsed accordion per non-empty type (`Text/Audio/Video/Other Downloads`, ids `…--text` etc.).

Key cross-cutting details:
- API base is `dcsURL` (default `https://git.door43.org`) + `API_PATH` (`api/v1`). All requests go through `axios` and `buildQueryString`.
- **Expansion is controlled state:** every Accordion is controlled by the `expandedIds` Set (ids follow the `lang--owner--repo--version` DOM-id scheme). `handleAccordionToggle` is the single onChange handler and writes the URL hash on manual expansion; one effect fetches whatever an expanded level still needs (`fetchesInFlightRef` guards duplicates), so expansion — user click or deep link — is the only trigger for data loading. Never expand accordions by dispatching DOM clicks on MUI internals (MUI v6+ wraps `AccordionSummary` in a heading element, which silently breaks `firstElementChild.click()`); add ids to `expandedIds` instead.
- **Deep linking:** the URL hash (`lang--owner--repo--version`) is read on load and on `hashchange` into `accordionIdToShowRef` (state mirror `accordionIdToShow` triggers effects). An effect pre-expands every level of the target id, waits for each level's data to arrive, then scrolls to the deepest level that exists and clears the target — also when the fetched data proves the target absent, so it can't wait forever.
- **DOM size:** collapsed accordion details are unmounted (`slotProps` transition `unmountOnExit` via `ACCORDION_SLOT_PROPS`), so only expanded subtrees exist in the DOM (~200 collapsed languages are just summary rows).
- **Language-code casing (subtle):** the DCS catalog endpoints are **case-sensitive** on the `lang` query param, but `catalog/list/languages` returns canonical mixed-case codes (e.g. `ur-Deva`) while search results return lowercase (`ur-deva`). So API queries must lowercase the code (`lc.toLowerCase()`), but the `accordionMap` tree and DOM ids must stay keyed by the original mixed-case `lc` (passed down explicitly to the owner/entry/downloadable handlers — do **not** key off the API's lowercase `.language` field, or nesting and deep-links break). Also note empty results come back as `{"data": null}`, not `[]` — always null-guard `response.data.data`.
- File-type/format logic lives in standalone helpers (`getFileExt`, `getFormatFromName`, `getDescription`, `getSize`, `add*ToDownloadableTypes`) above the component, mapping extensions/URLs to MIME-ish format strings and MUI icons. `DownloadableFormatList` renders one downloadable-type list (with the per-chapter expander) and is shared by the version cards and the resource card.
- **Resource card quick links:** the repo-level card lists the newest PDF first (from the top entry's release, falling back to the newest version with PDFs; `pickSurfacePDF` takes a lone PDF, or among several only the canonical `<repo>_<tag>.pdf` — combined/companion PDFs stay in Text Downloads), a promoted YouTube link when the merged Other downloads contain one, then the Preview and DCS links, then the collapsed per-type download sections. The repo source zips (git archive + Scripture Burrito via `appendSourceZipFormats`) always live under Other Downloads, not the main links. Legacy `…--vN` deep links (from before version accordions were removed) gracefully fall back to opening the resource card.

Props are `languages`, `owners`, `subjects`, `mediaTypes`, `stage`, `dcsURL` (base host only — `API_PATH` is appended internally); the README documents them.
- **Media filtering:** `mediaTypes` (`['pdf','audio','video','stream','other']`) adds `hasPdf`-style params to the language/owner/entry queries (note the casing — DCS silently ignores `hasPDF`).
- **`includeHistory` policy (July 2026):** never send it to `stats-ext` or the `list/*` endpoints — it inflates counts/lists with superseded releases, and DCS now computes `has*`/stats from current entries without it. The **only** intentional use is the per-repo versions fetch (`fetchCatalogEntriesWithDownloadables`), which needs every release to build the download sections.

### `DcsCatalogFilter` (`src/components/DcsCatalogFilter.jsx`)
A filter bar over the catalog driven by the **`catalog/stats-ext`** endpoint: Resources (the `subjects` facet) / Languages / Publishers multi-select autocompletes and a "Media" multi-select — every dropdown option carries a live entry count (`Open Bible Stories (343)`, `PDF (66)`, …) — plus a stats summary line (`entry_count`, `lang_count`) and a Clear Filters button (rendered only while something is selected). Newer DCS servers return stats-ext `subjects`/`owners`/`languages` as `{value: entryCount}` maps; older ones return plain lists — `normalizeStatsList` accepts both, and options render without counts against old servers. Counts appear only in the open dropdowns (`renderOption`), never in the selected-value chips; language counts sum casing variants that the options dedupe. The `subjects`/`languages`/`owners` props are the *universe* being filtered as well as the default option lists. Key behaviors:

- **Per-facet option queries:** every selection change re-queries stats-ext once with all effective params (for the stats line) plus once per selected facet with that facet's own selection swapped back to its prop default — otherwise a selected subject would shrink the subject dropdown to itself. Identical queries are deduped, so the unfiltered state is a single request. While nothing is selected, a non-empty prop list is shown verbatim as options (it may deliberately be wider than stats-ext returns).
- **Canonicalization:** stats-ext returns lowercased owners and language codes (sometimes both casings of the same code). `catalog/list/owners` / `catalog/list/languages` are fetched once per universe into `ownersInfo`/`langsInfo` (keyed lowercase) to provide display names (`full_name`, `ln`/`ang`) and the canonical casing; options are deduped case-insensitively. Language autocomplete matches on `ln`, `ang` and `lc`; publishers on `full_name` and username.
- **Outputs:** `onFilterChange` fires only when a selection actually changes (never on mount) with `{ subjects, languages, owners, stage, mediaTypes, isFiltered }`, each list falling back to the prop defaults when empty — ready to spread onto the accordion. `onStatsChange` delivers each new stats-ext response.
- **`selectedLanguages` push prop:** identity-triggered (a new array reference applies it); codes are canonicalized against `langsInfo` and unknown codes dropped — this is how map regions (2,000+ codes) become a manageable selection. `[]` clears the selection.
- **Identity discipline:** effects key off JSON signatures (`propsSig`/`selectionsSig`) and read values through render-assigned refs, so consumers recreating prop arrays every render don't cause refetch loops.

### `DcsCatalogBrowser` (`src/components/DcsCatalogBrowser.jsx`)
Thin composer of map + filter + accordion with shared state; `showMap`/`showFilter` (both default `true`) turn pieces off so a static page gets any combination from one `createRoot().render()`. Map clicks push a **fresh array** into the filter's `selectedLanguages` (so re-clicking the same continent re-applies it); the filter's `onFilterChange` output becomes the accordion's props. `setFilter` keeps the previous state object when a JSON-equal payload arrives — the accordion's effects depend on array identity, so this guard prevents needless full reloads. Without the filter, map clicks drive the accordion's `languages` directly.

### `WorldLanguageMap` (`src/components/WorldLanguageMap.jsx`)
An interactive SVG world map. Continent styling and region mapping come from `src/data/map.js`; `src/data/regions.js` maps a region to its list of language codes (2,000+ codes per region — never send these as query params; the accordion and filter intersect them client-side). It attaches raw DOM `click`/`mouseenter`/`mouseleave` listeners to the `#world-map` SVG (not React handlers) and calls `onContinentClick(languageCodes)` (empty array for "Show All") so a parent can drive the filter's `selectedLanguages` or the accordion's `languages` prop — `DcsCatalogBrowser` does exactly this.

## Build/deploy notes

- `vite-plugin-static-copy` copies `index-build.html` → `dist/index.html` at build time, so the published `dist/` ships a standalone demo page alongside the library bundles. It renders a single `DcsCatalogBrowser` (URL params: `subject`/`language`/`owner`/`stage`/`server`, plus `map=0` / `filter=0` to disable pieces). The page must load pinned, matching **production** React 18 UMDs — unpinned `unpkg.com/react/umd/...` URLs now resolve to React 19 and 404.
- **npm publishing is automated:** create a GitHub release tagged `vX.Y.Z` (matching package.json's version) and `.github/workflows/npm-publish.yml` builds and publishes with the org's `NPM_TOKEN` secret; it skips if the version is already on the registry. After publishing, the exact-version unpkg pin on consuming pages (openbiblestories.org/library) must be bumped by hand.
- Deployed via Netlify (`netlify.toml`): `pnpm build && pnpm build:demo`, publish `dist-demo` — the dev sandbox (demo-mode switcher) at `/`, and the UMD static-embed page at `/embed.html` (index-build.html + the just-built bundle, copied in by `vite.demo.config.js`). The sandbox shows the embed-page link only in production builds (`import.meta.env.PROD`).
- `storybook-static/` is build output — gitignored and ESLint-ignored; never commit it.
