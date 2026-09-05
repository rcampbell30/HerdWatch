# Immunity Map

Immunity Map is an MMR vaccination coverage tracker for England. It groups UKHSA COVER records by the postcode district of each GP practice and presents descriptive coverage bands in a black/red/cream civic dashboard style.

Repository note: the GitHub repository remains `HerdWatch`, but the public-facing product name is now **Immunity Map**.

## Current status

Immunity Map has been rebuilt as a clean editable React + TypeScript + Vite project and now uses rebuilt real data files rather than the earlier placeholder trend/scaffold state.

The Explorer is a real MapLibre geographic view. It plots every represented practice-postcode district at a lightweight ONS-derived reference centroid, draws a generalised official England outline, distinguishes small samples, and keeps the complete filterable table as an accessible fallback.

Current generated metadata reports:

- Example data: false
- Source files: `data/raw/areas.csv` and `data/raw/trends.csv`
- Postcode-district area records: 1,857
- Duplicate postcode districts: 0
- Like-for-like quarterly trend points: 2
- Well below target areas (below 90%): 856
- Below target areas (90% to below 95%): 594
- Areas meeting the target (95% or higher): 407

The public dashboard is an explanatory public-health data interface, not medical advice or an official NHS/UKHSA service. Practice postcode districts must not be interpreted as the home location of registered children.

## Important data note

The editable source project now includes normalised generated data under both `src/data/generated/` and `public/data/`.

The raw official source downloads themselves are not committed because the original source/reference files can be large and are reproducible through the data pipeline. The committed normalised CSV/JSON outputs are what the React app builds from.

Before presenting the project as fully production-grade public-health infrastructure, keep the source methodology visible and periodically refresh the data from official NHS/UKHSA sources.

## Programmatic local SEO

The production build now creates static route entrypoints for every generated postcode-district page under:

```text
/town/{postcode-district}/
```

Each generated town page gets route-specific search metadata:

- unique `<title>`;
- unique meta description;
- `index, follow` robots tag;
- canonical URL;
- Open Graph and Twitter metadata;
- JSON-LD `WebPage` structured data;
- a noscript local coverage summary using the same generated area data.

The build also generates `dist/sitemap.xml` from the current route list and generated area data. The sitemap includes the core public routes and every `/town/{postcode-district}/` page.

`public/robots.txt` points crawlers to the generated sitemap.

A final build-time branding pass applies the public product name **Immunity Map** across generated HTML/JS/CSS/XML/TXT output so older standalone static pages do not leak the previous public brand.

## Tech stack

- Vite
- React
- TypeScript
- Netlify static deployment
- Node data-build scripts
- Node static SEO route generation
- Node sitemap generation
- Node public branding pass
- Python COVER conversion scripts
- MapLibre GL JS geographic explorer

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

The production build runs the data pipeline, builds the Vite app, creates static route entrypoints, creates the sitemap, injects the AdSense meta tag, then applies the public branding pass.

Netlify settings are included in `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

## Data pipeline

The app reads generated JSON files from:

```text
src/data/generated/areas.json
src/data/generated/trends.json
public/data/areas.json
public/data/trends.json
public/data/metadata.json
public/data/map-centroids.json
public/data/england-outline.geojson
```

These files are built from CSV inputs under:

```text
data/raw/areas.csv
data/raw/trends.csv
```

Run the standard data pipeline with:

```bash
npm run data:build
```

The script will:

- parse the raw CSV files;
- calculate risk status from coverage;
- validate duplicate postcode districts;
- validate coverage ranges;
- reject records where vaccinated children exceed eligible children;
- write generated JSON for the React app;
- write public JSON for static/route use;
- write metadata to `public/data/metadata.json`.

Expected area CSV columns:

```csv
postcode_district,region,practice_count,total_eligible,total_vaccinated,coverage
```

Expected trend CSV columns:

```csv
year,england_mmr1,england_mmr2,target
```

If `coverage` is blank in the area CSV, it will be calculated from `total_vaccinated / total_eligible * 100`.

## Geographic map data

The deployable geography files are derived from the official ONS Postcode Directory (May 2026) and ONS Countries (December 2025) ultra-generalised boundary. Each map point is the arithmetic mean of live England postcode-unit centroids in an outward postcode district represented by the COVER data.

The point is a district reference location only. It is not a patient location, exact GP-practice coordinate, postcode boundary or resident-population estimate.

The 235 MB ONSPD source archive is deliberately not committed. After downloading it from the ONS Open Geography Portal, refresh and validate geography with:

```bash
npm run map:geography -- --onspd-zip /path/to/ONSPD_MAY_2026.zip
npm run map:validate
```

Every production build runs `map:validate` and will fail if current coverage districts and map coordinates fall out of sync.

## Real COVER source workflow

The repo includes scripts for refreshing from official COVER-style source files:

```bash
npm run data:download
npm run data:cover:areas
npm run data:cover:trends
npm run data:cover:all
```

`data/raw/source/`, `data/raw/ref/` and processed reports are ignored because they are reproducible/downloaded build inputs.

## Project structure

```text
src/
  App.tsx
  main.tsx
  styles.css
  types.ts
  data/
    areas.ts
    trends.ts
    generated/
      areas.json
      trends.json
data/
  raw/
    areas.csv
    trends.csv
    areas.example.csv
    trends.example.csv
  processed/
    .gitkeep
scripts/
  apply-public-branding.mjs
  build-data.mjs
  build-cover-areas.py
  build-cover-trends.py
  build-map-geography.py
  validate-map-data.mjs
  create-sitemap.mjs
  create-static-route-entrypoints.mjs
  download-cover-sources.mjs
  inject-adsense-meta.mjs
public/
  data/
    areas.json
    trends.json
    metadata.json
    map-centroids.json
    england-outline.geojson
  _redirects
  _headers
  404.html
  editorial.css
  favicon.svg
  og-immunity-map.png
  robots.txt
index.html
netlify.toml
vite.config.ts
tsconfig.json
```

## Potential next upgrades

1. Add local authority/ICB summary pages for search and public usefulness.
2. Add a `/rankings/` page for lowest coverage, biggest estimated unvaccinated counts and areas closest to the 95% target.
3. Add screenshots to this README.

## Reporting dates, count precision and search

The dashboard displays the GP reporting period independently from the national comparison series.
`data/raw/areas-provenance.json` holds the area CSV SHA-256, source filename, reporting period and last successful source import timestamp. The COVER importer writes it after producing the CSV. `data:build` checks the digest and never invents or advances an import timestamp. If the CSV is replaced without matching provenance, the UI shows unknown dates. The historical committed CSV has a documented reporting period but no recoverable source import timestamp.

`generatedAt` remains the JSON build timestamp, not the age of the observations. A successful re-import of a configured file is not discovery of a new UKHSA release. Review and update source URLs in `scripts/download-cover-sources.mjs` and national quarterly snapshots in `scripts/build-cover-trends.py` when new releases become available.

Counts derived from vaccinated totals are conservatively labelled approximate throughout the dashboard, local pages and generated HTML/structured data, because the existing importer may reconstruct numerators from rounded percentages and the historical CSV does not retain per-row precision flags. Eligible record and practice counts remain unmodified.

Search on Home, All Areas and Explorer accepts full postcodes (including lowercase or no space), exact districts, NHS groupings and GP-address town names. A full postcode is reduced locally to its outward district; no address lookup service is called. Ambiguous place searches open all matches, not an arbitrary first district.

Place aliases in `src/data/generated/search-places.json` are drawn from active GP address towns in the NHS ODS epraccur reference (initial index retrieved 5 September 2026). They identify search matches, not town boundaries or the user's registered practice. The index covers 1,852 of the existing 1,857 districts; all districts remain searchable by postcode. It is rebuilt at the end of `data:cover:all`, or explicitly with:

```bash
npm run data:places
npm test
```

The place-index builder validates the known 27-field epraccur layout and minimum district match rate before writing. If the source format changes, review the town/postcode/status fields before changing that validation. Normal static builds use the committed index and require no external geocoding API.
