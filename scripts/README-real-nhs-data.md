# Real NHS COVER data import notes

HerdWatch is now ready for real NHS COVER data, but the real dataset itself still needs to be downloaded and converted into CSV.

## Official source

Use the NHS Digital / GOV.UK COVER publication page for the relevant quarter or year.

Current rebuilt target used by HerdWatch:

```text
NHS COVER Q3 2024–25 · England
```

The publication usually includes supplementary data downloads. The file needed for area-level HerdWatch data is the GP-level supplementary data file, then grouped or normalised to postcode district.

## Files HerdWatch expects

Put real data here:

```text
data/raw/areas.csv
data/raw/trends.csv
```

Then run:

```bash
npm run data:build
npm run build
```

The build script will generate:

```text
src/data/generated/areas.json
src/data/generated/trends.json
public/data/areas.json
public/data/trends.json
public/data/metadata.json
data/processed/data-report.json
```

## areas.csv schema

```csv
postcode_district,region,practice_count,total_eligible,total_vaccinated,coverage
```

Example:

```csv
M15,North West,2,250,121,48.4
```

Notes:

- `postcode_district` should be uppercase, e.g. `FY1`, `M15`, `LS12`.
- `coverage` can be blank; the script will calculate it from `total_vaccinated / total_eligible * 100`.
- Risk status is calculated automatically:
  - below 90 = `AT_RISK`
  - 90 to below 95 = `VULNERABLE`
  - 95+ = `PROTECTED`

## trends.csv schema

```csv
year,england_mmr1,england_mmr2,target
```

Example:

```csv
2024–25 Q3,88.9,84.0,95
```

## Why this file exists

The original Netlify export did not include the raw NHS files or the original import code. This rebuild therefore cannot truthfully claim to contain the full real NHS COVER dataset until the official supplementary file has been added under `data/raw/` and regenerated.
