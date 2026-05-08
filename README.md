# HerdWatch

HerdWatch is an MMR vaccination coverage tracker for England. It highlights local coverage, herd-immunity gaps and outbreak vulnerability using a black/red/cream civic dashboard style.

## Current status

This repository originally contained a deployed/exported Next.js build from Netlify, not the original editable source code. It has now been rebuilt as a clean editable React + TypeScript + Vite project while preserving the current look and headline content from the deployed site.

Preserved headline figures from the deployed export:

- England MMR1 average: 88.9%
- Herd-immunity target: 95%
- Unvaccinated children: 14,295
- Total postcode districts tracked in the original deployed site: 1,132
- At-risk areas: 461
- Vulnerable areas: 441
- Protected areas: 230

## Important data note

The deployed static export did not include the original clean data import pipeline. The rebuilt source therefore includes:

- preserved headline stats from the deployed site;
- a starter area dataset reconstructed from visible deployed pages;
- placeholder historic trend data for developing the new chart UI.

Before presenting the trend chart as final analysis, replace the placeholder trend data with real historic NHS COVER extracts.

## Tech stack

- Vite
- React
- TypeScript
- Recharts
- Netlify static deployment

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

The app now reads generated JSON files from:

```text
src/data/generated/areas.json
src/data/generated/trends.json
```

These files are built from CSV inputs under:

```text
data/raw/areas.csv
data/raw/trends.csv
```

Example files are included so the pipeline works before the real NHS COVER extracts are restored:

```text
data/raw/areas.example.csv
data/raw/trends.example.csv
```

Run the data pipeline with:

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
- write a report to `data/processed/data-report.json`.

Expected area CSV columns:

```csv
postcode_district,region,practice_count,total_eligible,total_vaccinated,coverage
```

Expected trend CSV columns:

```csv
year,england_mmr1,england_mmr2,target
```

If `coverage` is blank in the area CSV, it will be calculated from `total_vaccinated / total_eligible * 100`.

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
    areas.example.csv
    trends.example.csv
  processed/
    .gitkeep
scripts/
  build-data.mjs
public/
  _redirects
index.html
netlify.toml
vite.config.ts
tsconfig.json
```

## Next proper upgrade

1. Restore the full NHS COVER dataset into `data/raw/areas.csv`.
2. Add real historic MMR1/MMR2 coverage into `data/raw/trends.csv`.
3. Run `npm run data:build` to replace the scaffold data.
4. Upgrade the map page with Leaflet or a lightweight SVG/GeoJSON view.
5. Add CI so every pull request runs `npm run data:build` and `npm run build`.
