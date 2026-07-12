# DCS Catalog Accordion RCL

A React component library for browsing the [DCS (Door43 Content Service)](https://git.door43.org) catalog as a lazily-loaded, deep-linkable accordion, published to npm as [`dcs-catalog-accordion-rcl`](https://www.npmjs.com/package/dcs-catalog-accordion-rcl).

Two components are exported:

- **`DcsCatalogAccordion`** — a four-level nested accordion (language → owner → resource → version) that fetches each level from the DCS catalog API on expand and offers download links (PDF, audio, video, source zips) per version.
- **`WorldLanguageMap`** — an interactive SVG world map whose `onContinentClick` callback supplies language codes, typically used to drive the accordion's `languages` prop.

The primary consumer is [openbiblestories.org/library](https://openbiblestories.org/library), which embeds the UMD bundle on a Squarespace page via `<script>` tags.

## Usage

### In a React app (npm)

React 18 is required (`react` and `react-dom` are peer dependencies, `^18`):

```bash
npm install dcs-catalog-accordion-rcl react@18 react-dom@18
```

```jsx
import { DcsCatalogAccordion, WorldLanguageMap } from 'dcs-catalog-accordion-rcl';

<DcsCatalogAccordion
  languages={['en', 'fr']}
  owners={['unfoldingWord', 'Door43-Catalog']}
  subjects={['Aligned Bible', 'TSV Translation Notes']}
  stage="prod"
  dcsURL="https://git.door43.org"
/>
```

### On a static page (UMD script tags)

Load React 18 UMD builds (production, **matching versions**) before the library bundle, then render with `ReactDOM.createRoot`:

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/dcs-catalog-accordion-rcl@0.1.18/dist/dcs-map-and-accordion.umd.js"></script>
<script>
  const { DcsCatalogAccordion, WorldLanguageMap } = DcsMapAndAccordion;
  ReactDOM.createRoot(document.getElementById('accordion-div'))
    .render(React.createElement(DcsCatalogAccordion, { subjects: ['Open Bible Stories'] }));
</script>
```

Pin the library to an exact version and bump the pin when a new version is released. See [index-build.html](index-build.html) (a full working example, shipped as `dist/index.html`) and [index-obs.html](index-obs.html) (the openbiblestories.org page).

> **Note:** React must stay on 18.x for this embedding style — React 19 no longer ships UMD builds.

### Deep linking

The accordion reads the URL hash on load (and on `hashchange`) and auto-expands down to the target, using `--` as the level separator:

```
https://example.org/library#en--unfoldingWord--en_obs--v9
                            └lang └owner        └repo  └version (each level optional)
```

Expanding accordions by hand writes the same hash back to the URL, so any state is shareable as a link.

### Props

`DcsCatalogAccordion`:

| Prop | Default | Description |
|---|---|---|
| `languages` | all languages | Array of language codes to filter by (e.g. `['en', 'es-419']`) |
| `owners` | all owners | Array of DCS owner/organization names to filter by |
| `subjects` | all subjects | Array of resource subjects to filter by (e.g. `['Open Bible Stories']`) |
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
| `pnpm dev` | Vite dev server at http://localhost:5173 — renders `src/App.jsx`, a demo wiring both components together against the live DCS API |
| `pnpm lint` | ESLint (`--max-warnings 0`, so warnings fail) |
| `pnpm build` | Build the library to `dist/` (minified UMD + ES bundles, plus the demo HTML pages) |
| `pnpm preview` | Serve the built `dist/` at http://localhost:4173 |
| `pnpm storybook` | Storybook at http://localhost:6006 |
| `pnpm build-storybook` | Static Storybook build to `storybook-static/` (gitignored) |

### Storybook

The repo uses **Storybook 10** (`@storybook/react-vite`). Stories live in `src/stories/`:

- **DcsCatalogAccordion** — All Languages, English Only, Open Bible Stories (the five OBS subjects), and unfoldingWord-owner variants, with live controls for `subjects`/`languages`/`owners`/`stage`.
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
