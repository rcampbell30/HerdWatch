# HerdWatch

HerdWatch is an MMR vaccination coverage tracker for England. It highlights local coverage, herd-immunity gaps and outbreak vulnerability using a black/red/cream civic dashboard style.

## Current status

This repository originally contained a deployed/exported Next.js build from Netlify, not the original editable source code. The `rebuild-source-v1` branch reconstructs HerdWatch as a clean editable React + TypeScript + Vite project while preserving the current look and headline content from the deployed site.

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
public/
  _redirects
index.html
netlify.toml
vite.config.ts
tsconfig.json
```

## Next proper upgrade

1. Restore the full NHS COVER dataset into `src/data` or `public/data`.
2. Add real historic MMR1/MMR2 coverage by year or quarter.
3. Replace scaffolded town records with all 1,132 postcode districts.
4. Upgrade the map page with Leaflet or a lightweight SVG/GeoJSON view.
5. Add automated data-validation scripts before deployment.
