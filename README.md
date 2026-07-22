# DCS Catalog Accordion RCL

A React component library for browsing the [DCS (Door43 Content Service)](https://git.door43.org) catalog as a lazily-loaded, deep-linkable accordion, published to npm as [`dcs-catalog-accordion-rcl`](https://www.npmjs.com/package/dcs-catalog-accordion-rcl).

Four components are exported:

- **`DcsCatalogBrowser`** — the all-in-one component: composes the world map, the stats filter and the catalog accordion with shared state (map clicks select the region's languages in the filter; the filter drives the accordion). `showMap` / `showFilter` props turn the extra pieces off, so one render call covers every combination.
- **`DcsCatalogAccordion`** — a lazily-loaded three-level nested accordion (language → owner → resource) that fetches each level from the DCS catalog API on expand; each resource card offers quick links (newest PDF, YouTube, Preview, DCS) plus collapsed Text/Audio/Video/Other download sections merged across release versions. Chapterized audio/video releases are grouped into collapsible per-quality chapter lists; common media formats are recognized (audio: mp3, m4a, aac, ogg, opus, flac, wav…; video: mp4, m4v, webm, mkv, mov, avi, 3gp…).
- **`DcsCatalogFilter`** — a filter bar driven by the `catalog/stats-ext` endpoint: Resources (subjects) / Languages / Publishers autocompletes plus a "Media" dropdown, every dropdown option showing its live entry count (`Open Bible Stories (343)`, `PDF (66)`, …), with an entry/language stats line underneath. Reports the effective filter through `onFilterChange` so anything (typically the accordion) can consume it.
- **`WorldLanguageMap`** — an interactive SVG world map whose `onContinentClick` callback supplies language codes, typically used to drive the filter's language selection or the accordion's `languages` prop.

The primary consumer is [openbiblestories.org/library](https://openbiblestories.org/library), which embeds the UMD bundle on a Squarespace page via `<script>` tags.

## How the pieces fit together

`DcsCatalogBrowser` wires the three building blocks with shared state:

1. **Map → Filter:** a `WorldLanguageMap` click emits the region's language codes, which the browser pushes into `DcsCatalogFilter`'s `selectedLanguages`. The filter intersects them with the languages actually in the catalog (region lists hold 2,000+ codes) and makes them the language selection; the map's "Show All" clears it.
2. **Filter → Accordion:** on every selection change the filter re-queries `catalog/stats-ext` (refreshing the option lists, their entry counts, and the stats line) and emits the effective filter through `onFilterChange` — `{ subjects, languages, owners, stage, mediaTypes, isFiltered }`, each list falling back to the given defaults when nothing is selected. The browser spreads that payload onto `DcsCatalogAccordion`, which reloads to show only matching resources.
3. **Any combination:** `showMap={false}` / `showFilter={false}` drop pieces (without the filter, map clicks drive the accordion's `languages` directly), and each component is exported for fully custom wiring — the accordion just needs its filter props, the filter just needs its callbacks, the map just needs `onContinentClick`.

## Usage

### In a React app (npm)

React 18 is required (`react` and `react-dom` are peer dependencies, `^18`):

```bash
npm install dcs-catalog-accordion-rcl react@18 react-dom@18
```

```jsx
import { DcsCatalogBrowser } from 'dcs-catalog-accordion-rcl';

// Map + filter + accordion, wired together:
<DcsCatalogBrowser
  subjects={['Open Bible Stories', 'OBS Translation Notes', 'OBS Translation Questions', 'OBS Study Notes', 'OBS Study Questions']}
  languages={[]}
  owners={[]}
  stage="prod"
  dcsURL="https://git.door43.org"
/>
```

Or compose the pieces yourself (this mirrors what `DcsCatalogBrowser` does internally):

```jsx
import { useState } from 'react';
import { DcsCatalogAccordion, DcsCatalogFilter, WorldLanguageMap } from 'dcs-catalog-accordion-rcl';

function Library() {
  const defaults = { subjects: ['Open Bible Stories'], languages: [], owners: [] };
  const [filter, setFilter] = useState(null);
  const [mapLanguages, setMapLanguages] = useState(null);
  return (
    <>
      {/* a fresh array per click lets re-clicking the same continent re-apply it */}
      <WorldLanguageMap onContinentClick={(langs) => setMapLanguages([...langs])} />
      <DcsCatalogFilter {...defaults} selectedLanguages={mapLanguages} onFilterChange={setFilter} />
      <DcsCatalogAccordion {...(filter || defaults)} />
    </>
  );
}
```

### On a static page (UMD script tags)

Load React 18 UMD builds (production, **matching versions**) before the library bundle, then render with `ReactDOM.createRoot`. Note the target div comes **before** the render script (scripts run as the page parses, so rendering into a div that appears later in the document finds nothing and throws) — the ready-state guard is extra insurance for CMS blocks like Squarespace:

```html
<div id="library-div" style="max-width: 960px; text-align: left;">Loading...</div>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/dcs-catalog-accordion-rcl@0.3.1/dist/dcs-map-and-accordion.umd.js"></script>
<script>
  function renderLibrary() {
    const { DcsCatalogBrowser } = DcsMapAndAccordion;
    ReactDOM.createRoot(document.getElementById('library-div')).render(
      React.createElement(DcsCatalogBrowser, {
        subjects: ['Open Bible Stories', 'OBS Translation Notes', 'OBS Translation Questions', 'OBS Study Notes', 'OBS Study Questions'],
        showMap: true,    // set false for filter + accordion only
        showFilter: true, // set false for map + accordion only
      })
    );
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderLibrary);
  } else {
    renderLibrary();
  }
</script>
```

Pin the library to an exact version and bump the pin when a new version is released. See [index-build.html](index-build.html) for a full working example (shipped as `dist/index.html` — it supports `?map=0` and `?filter=0` to try the combinations).

> **Note:** React must stay on 18.x for this embedding style — React 19 no longer ships UMD builds.

### Deep linking

The accordion reads the URL hash on load (and on `hashchange`) and auto-expands down to the target, using `--` as the level separator:

```
https://example.org/library#en--unfoldingWord--en_obs--audio
                            └lang └owner        └repo  └section (each level optional)
```

The optional fourth part names one of the resource card's download sections (`text`, `audio`, `video`, or `other`).

Expanding accordions by hand writes the same hash back to the URL, so any state is shareable as a link.

### Props

`DcsCatalogBrowser`:

| Prop | Default | Description |
|---|---|---|
| `subjects` / `languages` / `owners` | `[]` (everything) | The catalog universe being browsed; passed to the filter as its defaults and to the accordion |
| `stage` | `"prod"` | Catalog stage: `"prod"` (releases), `"latest"` (default branch + releases), or `"other"` |
| `dcsURL` | `https://git.door43.org` | Base URL of the DCS server (`/api/v1` is appended internally) |
| `showMap` | `true` | Render the world map above the filter/accordion |
| `showFilter` | `true` | Render the stats filter bar above the accordion |
| `onFilterChange` | — | `(filter) => void`, the filter's effective output (see `DcsCatalogFilter`) |
| `onStatsChange` | — | `(stats) => void`, the latest `catalog/stats-ext` response |

`DcsCatalogFilter`:

| Prop | Default | Description |
|---|---|---|
| `subjects` / `languages` / `owners` | `[]` (everything) | Default filter values and the universe the dropdown options come from (via `catalog/stats-ext`) |
| `stage` | `"prod"` | Catalog stage |
| `dcsURL` | `https://git.door43.org` | Base URL of the DCS server |
| `selectedLanguages` | — | Externally pushed language selection (e.g. a map region's codes); unknown codes are dropped, an empty array clears the selection |
| `onFilterChange` | — | `(filter) => void` with `{ subjects, languages, owners, stage, mediaTypes, isFiltered }` — each list falls back to the given defaults when nothing is selected, ready to spread onto `DcsCatalogAccordion` |
| `onStatsChange` | — | `(stats) => void`, the latest `catalog/stats-ext` response for the current selection |

`DcsCatalogAccordion`:

| Prop | Default | Description |
|---|---|---|
| `languages` | all languages | Array of language codes to filter by (e.g. `['en', 'es-419']`), matched case-insensitively |
| `owners` | all owners | Array of DCS owner/organization names to filter by |
| `subjects` | all subjects | Array of resource subjects to filter by (e.g. `['Open Bible Stories']`) |
| `mediaTypes` | `[]` | Only show resources having these media, any of `'pdf'`, `'audio'`, `'video'`, `'stream'`, `'other'` (the filter's Media selection) |
| `stage` | `"prod"` | Catalog stage: `"prod"` (releases), `"latest"` (default branch + releases), or `"other"` |
| `dcsURL` | `https://git.door43.org` | Base URL of the DCS server (`/api/v1` is appended internally) |

`WorldLanguageMap`:

| Prop | Default | Description |
|---|---|---|
| `onContinentClick` | — | `(languageCodes: string[]) => void`, called with the clicked region's language codes (empty array for "Show All") |

## Development

Requirements: **Node 22+** and **pnpm 11** (`npm install -g pnpm`). Then:

```bash
git clone https://github.com/unfoldingWord/dcs-catalog-accordion-rcl.git
cd dcs-catalog-accordion-rcl
pnpm install
```

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server at http://localhost:5173 — the demo sandbox (`src/App.jsx`, see below) |
| `pnpm lint` | ESLint (`--max-warnings 0`, so warnings fail) |
| `pnpm build` | Build the library to `dist/` (minified UMD + ES bundles, plus the demo HTML pages) |
| `pnpm build:demo` | Build the demo sandbox site to `dist-demo/` (what Netlify serves; run `pnpm build` first — it copies the UMD bundle) |
| `pnpm preview` | Serve the built `dist/` at http://localhost:4173 |
| `pnpm storybook` | Storybook at http://localhost:6006 |
| `pnpm build-storybook` | Static Storybook build to `storybook-static/` (gitignored) |

### Demoing the components

Three ways to see everything working against the live DCS API:

- **Dev sandbox** (`pnpm dev`, renders `src/App.jsx`): buttons switch between every combination — Map + Filter + Accordion, Filter + Accordion, Map + Accordion, Accordion only, and Filter only (which prints each `onFilterChange` payload; an expandable panel shows the latest `onStatsChange` stats). It honors `?subject=&language=&owner=&stage=&server=&demo=` URL params and defaults to the **QA server** (qa.door43.org) — use `?server=PROD` for git.door43.org, or pass any `https://…` DCS URL. The same page is deployed by Netlify at **https://dcs-catalog-accordion.netlify.app/** (`pnpm build:demo` builds it to `dist-demo/`).
- **Built demo page** (`pnpm build && pnpm preview`, serves `dist/index.html` from [index-build.html](index-build.html)): the production-style embed — one `DcsCatalogBrowser` rendered from UMD script tags exactly like a static site would. Supports the same `subject`/`language`/`owner`/`stage`/`server` params plus `?map=0` / `?filter=0` to drop pieces. On the Netlify site it lives at [/embed.html](https://dcs-catalog-accordion.netlify.app/embed.html), using the UMD bundle built from the same commit.
- **Storybook** (`pnpm storybook`): per-component stories with live controls (see below).

### Storybook

The repo uses **Storybook 10** (`@storybook/react-vite`). Stories live in `src/stories/`:

- **DcsCatalogAccordion** — All Languages, English Only, Open Bible Stories (the five OBS subjects), and unfoldingWord-owner variants, with live controls for `subjects`/`languages`/`owners`/`stage`.
- **DcsCatalogBrowser** — map + filter + accordion combined, plus the `showMap`/`showFilter` off variants and a whole-catalog story.
- **DcsCatalogFilter** — the filter alone (whole catalog and OBS-subjects variants), including a story that prints each `onFilterChange` payload.
- **WorldLanguageMap** — the map alone, plus a combined map + accordion story mirroring the real embed.

Stories hit the live DCS catalog API, so allow a few seconds for data to load. Storybook opens directly on the accordion stories.

## Releasing

Publishing is automated by [.github/workflows/npm-publish.yml](.github/workflows/npm-publish.yml):

1. Bump `version` in `package.json`, commit, and push to `main`.
2. Create a GitHub release tagged `vX.Y.Z` (must match the package.json version — the workflow fails on mismatch).
3. The workflow builds and publishes to npm using the org's `NPM_TOKEN` automation secret. It skips publishing if that version is already on the registry, so re-runs are safe.
4. Update the pinned version on consuming pages (e.g. the unpkg URL on openbiblestories.org/library).

The npm package ships only `dist/` (see the `files` field in package.json).

## License

This project is licensed under the MIT License.
