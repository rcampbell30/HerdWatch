# Immunity Map

Immunity Map is an MMR vaccination coverage tracker for England. It highlights local coverage, herd-immunity gaps and outbreak vulnerability using a black/red/cream civic dashboard style.

Repository note: the GitHub repository remains `HerdWatch`, but the public-facing product name is now **Immunity Map**.

## Current status

Immunity Map has been rebuilt as a clean editable React + TypeScript + Vite project and now uses rebuilt real data files rather than the earlier placeholder trend/scaffold state.

Current generated metadata reports:

- Example data: false
- Source files: `data/raw/areas.csv` and `data/raw/trends.csv`
- Postcode-district area records: 1,889
- Duplicate postcode districts: 0
- Trend points: 5
- At-risk areas: 614
- Vulnerable areas: 833
- Protected areas: 442

The public dashboard should still be treated as an explanatory public-health data interface, not medical advice or an official NHS/UKHSA service.

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
- Recharts
- Netlify static deployment
- Node data-build scripts
- Node static SEO route generation
- Node sitemap generation
- Node public branding pass
- Python COVER conversion scripts

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
  create-sitemap.mjs
  create-static-route-entrypoints.mjs
  download-cover-sources.mjs
  inject-adsense-meta.mjs
public/
  data/
    areas.json
    trends.json
    metadata.json
  _redirects
  herdwatch-nav-patch.js
  robots.txt
index.html
netlify.toml
vite.config.ts
tsconfig.json
```

## Next proper upgrade

1. Add CI so every pull request runs `npm run data:build`, `npm run typecheck` and `npm run build`.
2. Add Leaflet, SVG, or GeoJSON-based map views.
3. Add local authority/ICB summary pages for search and public usefulness.
4. Add a `/rankings/` page for lowest coverage, biggest estimated unvaccinated counts and areas closest to the 95% target.
5. Add screenshots to this README.