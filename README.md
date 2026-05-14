# HerdWatch

HerdWatch is an MMR vaccination coverage tracker for England. It highlights local coverage, herd-immunity gaps and outbreak vulnerability using a black/red/cream civic dashboard style.

## Current status

HerdWatch has been rebuilt as a clean editable React + TypeScript + Vite project and now uses rebuilt real data files rather than the earlier placeholder trend/scaffold state.

Current generated metadata reports:

- Example data: false
- Source files: `data/raw/areas.csv` and `data/raw/trends.csv`
- Area rows: 1,889
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

## Tech stack

- Vite
- React
- TypeScript
- Recharts
- Netlify static deployment
- Node data-build scripts
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
  build-data.mjs
  build-cover-areas.py
  build-cover-trends.py
  download-cover-sources.mjs
public/
  data/
    areas.json
    trends.json
    metadata.json
  _redirects
index.html
netlify.toml
vite.config.ts
tsconfig.json
```

## Next proper upgrade

1. Add a clear methodology/source page to the live app.
2. Show the latest data timestamp and `usingExampleData: false` status in the UI footer or data notes.
3. Add CI so every pull request runs `npm run data:build` and `npm run build`.
4. Add Leaflet, SVG, or GeoJSON-based map views.
5. Add local authority/ICB summary pages for search and public usefulness.
6. Add screenshots to this README.
