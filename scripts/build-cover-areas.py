#!/usr/bin/env python3
"""Build HerdWatch area data from official COVER GP supplementary data.

The UKHSA/GOV.UK GP supplementary COVER workbook gives GP-level coverage values.
This script:
- detects the GP-level MMR1-at-24-months columns;
- joins GP practice codes to ODS practice postcode reference data;
- derives the correct postcode district/outward code, e.g. M7 from M7 3XX, not M73;
- aggregates GP rows into HerdWatch's data/raw/areas.csv schema.

Expected input after `npm run data:download`:
- data/raw/source/*.ods
- data/raw/ref/epraccur.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Iterable

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
SOURCE_DIR = RAW_DIR / "source"
REF_DIR = RAW_DIR / "ref"
PROCESSED_DIR = ROOT / "data" / "processed"

FULL_POSTCODE_RE = re.compile(r"^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$", re.I)
UK_POSTCODE_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$", re.I)
PRACTICE_CODE_RE = re.compile(r"^[A-Z][A-Z0-9]{4,7}$", re.I)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build HerdWatch postcode-district area data from COVER GP ODS data.")
    parser.add_argument("--source", type=Path, default=None, help="Specific COVER GP supplementary ODS file.")
    parser.add_argument("--reference", type=Path, default=REF_DIR / "epraccur.csv", help="ODS GP reference CSV.")
    parser.add_argument("--out", type=Path, default=RAW_DIR / "areas.csv", help="Output areas.csv path.")
    args = parser.parse_args()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    source = args.source or best_ods_source(SOURCE_DIR)
    if source is None:
        raise SystemExit("No ODS source file found. Run `npm run data:download` first.")
    if not args.reference.exists():
        raise SystemExit(f"Reference file not found: {args.reference}. Run `npm run data:download` first.")

    workbook = pd.read_excel(source, sheet_name=None, engine="odf")
    sheet_name, frame, columns = find_cover_sheet(workbook)
    ref = load_reference(args.reference)

    data = frame[[columns["practice_code"], columns["denominator"], columns["coverage"]] + ([columns["region"]] if columns.get("region") else [])].copy()
    data = data.rename(
        columns={
            columns["practice_code"]: "practice_code",
            columns["denominator"]: "total_eligible",
            columns["coverage"]: "coverage",
            columns.get("region") or "": "region",
        }
    )

    data["practice_code"] = data["practice_code"].astype(str).str.strip().str.upper()
    data = data[data["practice_code"].str.match(PRACTICE_CODE_RE, na=False)]
    data = data.merge(ref, on="practice_code", how="left")

    missing_postcode = int(data["postcode"].isna().sum())
    if missing_postcode:
        print(f"Warning: {missing_postcode} practices could not be matched to reference postcodes.")

    data["postcode_district"] = data["postcode"].apply(postcode_district)
    data = data[data["postcode_district"].notna()].copy()

    if "region" not in data.columns:
        data["region"] = data.get("reference_region", "Other")
    data["region"] = data["region"].fillna(data.get("reference_region", "Other")).fillna("Other")

    data["total_eligible"] = pd.to_numeric(data["total_eligible"], errors="coerce")
    data["coverage"] = pd.to_numeric(data["coverage"].astype(str).str.replace("%", "", regex=False), errors="coerce")
    data = data.dropna(subset=["total_eligible", "coverage"])
    data = data[data["total_eligible"] > 0]

    # The 2024-25 GP supplementary file exposes denominator + percentage, not a clean numerator.
    # Reconstruct an approximate vaccinated count so HerdWatch can aggregate and display counts.
    data["total_vaccinated"] = (data["total_eligible"] * data["coverage"] / 100).round()

    grouped = (
        data.groupby(["postcode_district", "region"], dropna=False)
        .agg(
            practice_count=("practice_code", "nunique"),
            total_eligible=("total_eligible", "sum"),
            total_vaccinated=("total_vaccinated", "sum"),
        )
        .reset_index()
    )

    # If one outward code has GP practices crossing ICB regions, collapse to one HerdWatch row.
    collapsed = []
    for postcode, group in grouped.groupby("postcode_district", dropna=False):
        total_eligible = int(round(group["total_eligible"].sum()))
        total_vaccinated = int(round(group["total_vaccinated"].sum()))
        regions = sorted(set(str(value) for value in group["region"].dropna()))
        collapsed.append(
            {
                "postcode_district": postcode,
                "region": regions[0] if len(regions) == 1 else "Multiple regions",
                "practice_count": int(group["practice_count"].sum()),
                "total_eligible": total_eligible,
                "total_vaccinated": total_vaccinated,
                "coverage": round(total_vaccinated / total_eligible * 100, 1) if total_eligible else 0,
            }
        )

    out = pd.DataFrame(collapsed).sort_values(["coverage", "postcode_district"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False, quoting=csv.QUOTE_MINIMAL)

    write_import_report(source, sheet_name, columns, len(frame), len(out), missing_postcode)
    print(f"Read {source.relative_to(ROOT)} sheet={sheet_name!r}.")
    print(f"Using practice_code={columns['practice_code']!r}, denominator={columns['denominator']!r}, coverage={columns['coverage']!r}.")
    print("Vaccinated counts reconstructed from denominator × coverage.")
    print(f"Wrote {len(out):,} postcode districts to {args.out.relative_to(ROOT)}.")
    print("Next: npm run data:build && npm run build")


def best_ods_source(directory: Path) -> Path | None:
    if not directory.exists():
        return None
    files = list(directory.glob("*.ods"))
    if not files:
        return None

    def score(path: Path) -> tuple[int, str]:
        name = path.name.lower()
        value = 0
        if "supplementary" in name:
            value += 40
        if "gp" in name:
            value += 40
        if "annual" in name:
            value += 30
        if "2024-to-2025" in name or "2024-2025" in name:
            value += 100
        if "data-tables" in name or "data_tables" in name:
            value -= 80
        return value, name

    return sorted(files, key=score, reverse=True)[0]


def find_cover_sheet(workbook: dict[str, pd.DataFrame]) -> tuple[str, pd.DataFrame, dict[str, str]]:
    guesses = []
    for sheet_name, raw in workbook.items():
        frame = normalise_frame(raw)
        columns = list(frame.columns)
        found = {
            "practice_code": find_col(columns, [r"^gpcode$", r"^gp code$", r"\bgpcode\b", r"practice.*code", r"ods.*code"]),
            "denominator": find_col(columns, [r"^number of children who reached 24 months$", r"children.*reached.*24 months", r"reached.*24 months"]),
            "coverage": find_col(columns, [r"^coverage at 24 months mmr1 \(%\)$", r"coverage.*24 months.*mmr1", r"mmr1.*24.*cover", r"coverage.*mmr"]),
            "region": find_col(columns, [r"^icb name$", r"region", r"nhs england region", r"ukhsa region"]),
        }
        score = sum(bool(value) for value in found.values())
        if found["practice_code"] and found["denominator"] and found["coverage"]:
            score += 10
        guesses.append({"sheet": sheet_name, "score": score, "columns": found, "all_columns": columns[:80]})

    guesses.sort(key=lambda item: item["score"], reverse=True)
    (PROCESSED_DIR / "cover-column-report.json").write_text(json.dumps({"guesses": guesses}, indent=2), encoding="utf-8")

    best = guesses[0] if guesses else None
    if not best or not best["columns"].get("practice_code") or not best["columns"].get("denominator") or not best["columns"].get("coverage"):
        raise SystemExit("Could not detect GP code, denominator and MMR1 coverage columns. See data/processed/cover-column-report.json.")

    return best["sheet"], normalise_frame(workbook[best["sheet"]]), best["columns"]


def normalise_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all").dropna(axis=1, how="all").copy()
    if df.empty:
        return df

    best_header_idx = 0
    best_score = -1
    for idx in range(min(12, len(df))):
        values = [normalise_col(value) for value in df.iloc[idx].tolist()]
        joined = " ".join(values)
        score = sum(keyword in joined for keyword in ["gpcode", "mmr", "coverage", "reached 24 months"])
        if score > best_score:
            best_header_idx = idx
            best_score = score

    header = [normalise_col(value) or f"col_{i}" for i, value in enumerate(df.iloc[best_header_idx].tolist())]
    out = df.iloc[best_header_idx + 1 :].copy()
    out.columns = dedupe(header)
    return out.dropna(how="all")


def normalise_col(value: object) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower()).replace("\n", " ")


def dedupe(columns: Iterable[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for column in columns:
        count = seen.get(column, 0)
        seen[column] = count + 1
        out.append(column if count == 0 else f"{column}_{count + 1}")
    return out


def find_col(columns: list[str], patterns: list[str]) -> str | None:
    for pattern in patterns:
        regex = re.compile(pattern, re.I)
        for column in columns:
            if regex.search(str(column)):
                return column
    return None


def load_reference(path: Path) -> pd.DataFrame:
    # ODS epraccur is currently a headerless CSV. Infer practice-code and postcode columns from values.
    ref = pd.read_csv(path, dtype=str, header=None).dropna(how="all").dropna(axis=1, how="all")
    practice_col = infer_column_by_values(ref, PRACTICE_CODE_RE, min_matches=20)
    postcode_col = infer_column_by_values(ref, UK_POSTCODE_RE, min_matches=20)

    if practice_col is None or postcode_col is None:
        report = {
            "source": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
            "shape": [int(ref.shape[0]), int(ref.shape[1])],
            "detected": {"practice_code": str(practice_col), "postcode": str(postcode_col)},
            "sample_rows": ref.head(5).fillna("").astype(str).to_dict(orient="records"),
        }
        (PROCESSED_DIR / "reference-column-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        raise SystemExit("Could not infer practice/postcode columns. See data/processed/reference-column-report.json.")

    out = ref[[practice_col, postcode_col]].copy()
    out.columns = ["practice_code", "postcode"]
    out["practice_code"] = out["practice_code"].astype(str).str.strip().str.upper()
    out["postcode"] = out["postcode"].astype(str).str.upper().str.replace(r"\s+", "", regex=True)
    out = out[out["practice_code"].str.match(PRACTICE_CODE_RE, na=False)]
    out = out[out["postcode"].str.match(UK_POSTCODE_RE, na=False)]
    out["reference_region"] = "Other"

    report = {
        "source": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "shape": [int(ref.shape[0]), int(ref.shape[1])],
        "detected": {"practice_code_column_index": int(practice_col), "postcode_column_index": int(postcode_col)},
        "sample_rows": ref.head(5).fillna("").astype(str).to_dict(orient="records"),
    }
    (PROCESSED_DIR / "reference-column-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return out.drop_duplicates(subset=["practice_code"])


def infer_column_by_values(df: pd.DataFrame, regex: re.Pattern[str], min_matches: int) -> int | None:
    best_col = None
    best_count = 0
    for column in df.columns:
        sample = df[column].dropna().astype(str).str.strip().head(800)
        count = int(sample.apply(lambda value: bool(regex.match(value))).sum())
        if count > best_count:
            best_col = column
            best_count = count
    return int(best_col) if best_count >= min_matches else None


def postcode_district(postcode: object) -> str | None:
    text = str(postcode).upper().replace(" ", "")
    match = FULL_POSTCODE_RE.match(text)
    return match.group(1) if match else None


def write_import_report(source: Path, sheet_name: str, columns: dict[str, str], raw_rows: int, area_rows: int, missing_postcode: int) -> None:
    report = {
        "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "sheet": sheet_name,
        "columns": columns,
        "rawRows": raw_rows,
        "areaRows": area_rows,
        "missingPostcodeMatches": missing_postcode,
        "note": "Vaccinated counts are reconstructed from denominator × coverage because the 2024-25 GP supplementary workbook exposes coverage percentages rather than a clean MMR1 numerator column.",
    }
    (PROCESSED_DIR / "cover-import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
