# Real NHS COVER data import notes

HerdWatch is now wired for real NHS COVER data.

It still needs the official source files to be downloaded and converted before the public dashboard can honestly claim to use the full real dataset.

## Official sources

Use official UKHSA/GOV.UK and NHS England sources only.

Known official source types:

- GOV.UK quarterly COVER programme publication pages.
- GOV.UK annual COVER programme publication pages.
- GOV.UK supplementary GP-level COVER ODS downloads.
- NHS England childhood vaccination statistics downloads, where CSV packs are available.
- NHS Organisation Data Service GP practice reference data for matching GP practice codes to postcodes.

The repo includes a downloader for known current/historic files:

```bash
npm run data:download
```

This downloads source/reference files into:

```text
data/raw/source/
data/raw/ref/
```

Those folders are intentionally ignored by Git because official ODS/ZIP source files can be large.

## Current rebuilt target used by HerdWatch

```text
NHS COVER Q3 2024–25 · England
```

The real area-level build should be based on GP-level supplementary COVER data, then grouped to postcode district using a GP-practice postcode reference file.

## One-command real-data pipeline

After Python dependencies are installed:

```bash
pip install -r requirements.txt
npm run data:cover:all
npm run build
```

This runs:

```bash
npm run data:download
python scripts/build-cover-areas.py
npm run data:build
```

## Python-only area conversion

If source files are already downloaded, run:

```bash
python scripts/build-cover-areas.py
```

This attempts to:

1. open the newest `.ods` file in `data/raw/source/`;
2. detect GP practice code, MMR denominator, MMR numerator and coverage columns;
3. join GP practice code to postcode using `data/raw/ref/epraccur.csv`;
4. derive postcode district from the GP postcode;
5. group records to postcode district;
6. write `data/raw/areas.csv`.

It also writes a detection report here:

```text
data/processed/cover-column-report.json
```

If column detection fails, inspect that report and update the regex aliases in:

```text
scripts/build-cover-areas.py
```

## Files HerdWatch expects

Real normalised data should end up here:

```text
data/raw/areas.csv
data/raw/trends.csv
```

Then run:

```bash
npm run data:build
npm run build
```

The build script generates:

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

Historic trend data should be manually checked against the relevant annual/quarterly COVER tables before being published as final.

## Why this file exists

The original Netlify export did not include the raw NHS files or the original import code. This rebuild therefore cannot truthfully claim to contain the full real NHS COVER dataset until the official supplementary file has been added under `data/raw/`, regenerated, checked and committed as generated JSON.
