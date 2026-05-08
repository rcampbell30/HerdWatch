#!/usr/bin/env python3
"""Build HerdWatch area data from official COVER GP supplementary data.

This script scans the downloaded COVER ODS workbook, detects likely GP-level
MMR1-at-24-months fields, joins GP practice codes to ODS practice postcode
reference data, derives postcode districts, and writes data/raw/areas.csv.

Expected input files after `npm run data:download`:
- data/raw/source/*.ods
- data/raw/ref/epraccur.csv

Output:
- data/raw/areas.csv
- data/processed/cover-column-report.json
- data/processed/reference-column-report.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
SOURCE_DIR = RAW_DIR / "source"
REF_DIR = RAW_DIR / "ref"
PROCESSED_DIR = ROOT / "data" / "processed"

POSTCODE_DISTRICT_RE = re.compile(r"^([A-Z]{1,2}\d[A-Z\d]?)")
UK_POSTCODE_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$", re.I)
PRACTICE_CODE_RE = re.compile(r"^[A-Z][A-Z0-9]{4,7}$", re.I)


@dataclass
class ColumnGuess:
    sheet: str
    practice_code: str | None
    region: str | None
    denominator: str | None
    numerator: str | None
    coverage: str | None
    score: int
    columns: list[str]


def main() -> None:
    parser = argparse.ArgumentParser(description="Build HerdWatch data/raw/areas.csv from official COVER GP ODS data.")
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Path to COVER GP supplementary ODS. Defaults to best available file in data/raw/source/.",
    )
    parser.add_argument(
        "--reference",
        type=Path,
        default=REF_DIR / "epraccur.csv",
        help="Path to ODS GP reference CSV containing practice code and postcode.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=RAW_DIR / "areas.csv",
        help="Output CSV path.",
    )
    args = parser.parse_args()

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    source = args.source or best_ods_source(SOURCE_DIR)
    if source is None:
        raise SystemExit("No ODS source file found. Run `npm run data:download` first or pass --source.")
    if not args.reference.exists():
        raise SystemExit(f"Reference file not found: {args.reference}. Run `npm run data:download` first.")

    workbook = pd.read_excel(source, sheet_name=None, engine="odf")
    guesses = [guess_columns(sheet_name, normalise_frame(df)) for sheet_name, df in workbook.items()]
    guesses.sort(key=lambda item: item.score, reverse=True)
    write_report(source, guesses)

    best = guesses[0] if guesses else None
    if not best or best.score < 4 or not best.practice_code:
        raise SystemExit(
            "Could not confidently detect GP-level MMR1 columns. "
            "See data/processed/cover-column-report.json and adjust column aliases in scripts/build-cover-areas.py."
        )

    df = normalise_frame(workbook[best.sheet])
    ref = load_reference(args.reference)

    required_cols = [best.practice_code]
    if best.denominator:
        required_cols.append(best.denominator)
    if best.numerator:
        required_cols.append(best.numerator)
    if best.coverage:
        required_cols.append(best.coverage)
    if best.region:
        required_cols.append(best.region)

    data = df[required_cols].copy()
    data = data.rename(
        columns={
            best.practice_code: "practice_code",
            best.denominator or "": "total_eligible",
            best.numerator or "": "total_vaccinated",
            best.coverage or "": "coverage",
            best.region or "": "region",
        }
    )

    data["practice_code"] = data["practice_code"].astype(str).str.strip().str.upper()
    data = data[data["practice_code"].str.match(r"^[A-Z0-9]{3,}$", na=False)]
    data = data.merge(ref, on="practice_code", how="left")

    missing_postcode = data["postcode"].isna().sum()
    if missing_postcode:
        print(f"Warning: {missing_postcode} practices could not be matched to reference postcodes.")

    data["postcode_district"] = data["postcode"].apply(postcode_district)
    data = data[data["postcode_district"].notna()].copy()

    if "region" not in data.columns:
        data["region"] = data.get("reference_region", "Other")
    data["region"] = data["region"].fillna(data.get("reference_region", "Other")).fillna("Other")

    if "total_eligible" in data.columns:
        data["total_eligible"] = pd.to_numeric(data["total_eligible"], errors="coerce")
    if "total_vaccinated" in data.columns:
        data["total_vaccinated"] = pd.to_numeric(data["total_vaccinated"], errors="coerce")
    if "coverage" in data.columns:
        data["coverage"] = pd.to_numeric(data["coverage"].astype(str).str.replace("%", "", regex=False), errors="coerce")

    if "total_eligible" not in data.columns or "total_vaccinated" not in data.columns:
        raise SystemExit("Numerator/denominator columns were not detected. See cover-column-report.json.")

    data = data.dropna(subset=["total_eligible", "total_vaccinated"])
    data = data[data["total_eligible"] > 0]

    grouped = (
        data.groupby(["postcode_district", "region"], dropna=False)
        .agg(
            practice_count=("practice_code", "nunique"),
            total_eligible=("total_eligible", "sum"),
            total_vaccinated=("total_vaccinated", "sum"),
        )
        .reset_index()
    )
    grouped["coverage"] = (grouped["total_vaccinated"] / grouped["total_eligible"] * 100).round(1)

    grouped = grouped.sort_values(["coverage", "postcode_district"])
    args.out.parent.mkdir(parents=True, exist_ok=True)
    grouped.to_csv(args.out, index=False, quoting=csv.QUOTE_MINIMAL)

    print(f"Read {source.relative_to(ROOT)} sheet={best.sheet!r}.")
    print(f"Wrote {len(grouped):,} postcode districts to {args.out.relative_to(ROOT)}.")
    print("Next: npm run data:build")


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
        if "2023-to-2024" in name or "2023-2024" in name:
            value += 80
        if "2022-to-2023" in name or "2022-2023" in name:
            value += 60
        if "quarter" in name or "october" in name or "december" in name:
            value += 15
        if "data-tables" in name or "data_tables" in name:
            value -= 80
        return (value, name)

    return sorted(files, key=score, reverse=True)[0]


def normalise_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all").dropna(axis=1, how="all").copy()
    if df.empty:
        return df

    best_header_idx = 0
    best_score = -1
    for idx in range(min(12, len(df))):
        values = [normalise_col(value) for value in df.iloc[idx].tolist()]
        joined = " ".join(values)
        score = sum(keyword in joined for keyword in ["practice", "mmr", "denominator", "numerator", "coverage"])
        if score > best_score:
            best_header_idx = idx
            best_score = score

    header = [normalise_col(value) or f"col_{i}" for i, value in enumerate(df.iloc[best_header_idx].tolist())]
    out = df.iloc[best_header_idx + 1 :].copy()
    out.columns = dedupe(header)
    return out.dropna(how="all")


def normalise_col(value: object) -> str:
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = text.replace("\n", " ")
    return text


def dedupe(columns: Iterable[str]) -> list[str]:
    seen: dict[str, int] = {}
    out: list[str] = []
    for column in columns:
        count = seen.get(column, 0)
        seen[column] = count + 1
        out.append(column if count == 0 else f"{column}_{count + 1}")
    return out


def guess_columns(sheet: str, df: pd.DataFrame) -> ColumnGuess:
    columns = list(df.columns)
    practice_code = find_col(columns, [r"\bpractice\b.*\bcode\b", r"\bgp\b.*\bcode\b", r"\bods\b.*\bcode\b", r"organisation.*code"])
    region = find_col(columns, [r"region", r"nhs england region", r"ukhsa region"])
    denominator = find_col(columns, [r"mmr.*24.*denom", r"mmr.*24.*eligible", r"mmr1.*24.*denom", r"mmr1.*eligible", r"denominator.*mmr"])
    numerator = find_col(columns, [r"mmr.*24.*num", r"mmr.*24.*vacc", r"mmr1.*24.*num", r"mmr1.*vacc", r"numerator.*mmr"])
    coverage = find_col(columns, [r"mmr.*24.*cover", r"mmr1.*24.*cover", r"mmr.*24.*%", r"coverage.*mmr"])

    score = sum(bool(value) for value in [practice_code, region, denominator, numerator, coverage])
    joined = " ".join(columns)
    if "mmr" in joined:
        score += 1
    if "24" in joined or "2 year" in joined or "2-year" in joined:
        score += 1
    if "practice" in joined or "gp" in joined:
        score += 1

    return ColumnGuess(sheet, practice_code, region, denominator, numerator, coverage, score, columns[:80])


def find_col(columns: list[str], patterns: list[str]) -> str | None:
    for pattern in patterns:
        regex = re.compile(pattern, re.I)
        for column in columns:
            if regex.search(str(column)):
                return column
    return None


def load_reference(path: Path) -> pd.DataFrame:
    ref = read_reference_csv(path)
    ref.columns = [normalise_col(column) for column in ref.columns]

    practice_col = find_col(
        list(ref.columns),
        [
            r"organisation.*code",
            r"organization.*code",
            r"org.*code",
            r"practice.*code",
            r"gp.*code",
            r"ods.*code",
            r"^code$",
        ],
    )
    postcode_col = find_col(list(ref.columns), [r"post\s*code", r"postcode", r"postal.*code"])
    region_col = find_col(list(ref.columns), [r"region", r"nhs england region", r"national grouping", r"high level health geography"])

    if not practice_col:
        practice_col = infer_column_by_values(ref, PRACTICE_CODE_RE, min_matches=20)
    if not postcode_col:
        postcode_col = infer_column_by_values(ref, UK_POSTCODE_RE, min_matches=20)

    write_reference_report(path, ref, practice_col, postcode_col, region_col)

    if not practice_col or not postcode_col:
        raise SystemExit(
            f"Could not identify practice/postcode columns in {path}. "
            "See data/processed/reference-column-report.json."
        )

    selected = [practice_col, postcode_col]
    if region_col:
        selected.append(region_col)

    out = ref[selected].copy()
    rename_map = {practice_col: "practice_code", postcode_col: "postcode"}
    if region_col:
        rename_map[region_col] = "reference_region"
    out = out.rename(columns=rename_map)

    if "reference_region" not in out.columns:
        out["reference_region"] = "Other"

    out["practice_code"] = out["practice_code"].astype(str).str.strip().str.upper()
    out["postcode"] = out["postcode"].astype(str).str.upper().str.replace(r"\s+", "", regex=True)
    out = out[out["practice_code"].str.match(PRACTICE_CODE_RE, na=False)]
    out = out[out["postcode"].str.match(r"^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$", na=False)]
    return out.drop_duplicates(subset=["practice_code"])


def read_reference_csv(path: Path) -> pd.DataFrame:
    attempts = [
        {"dtype": str},
        {"dtype": str, "sep": None, "engine": "python"},
        {"dtype": str, "header": None},
        {"dtype": str, "header": None, "sep": None, "engine": "python"},
    ]
    best: pd.DataFrame | None = None
    for kwargs in attempts:
        try:
            candidate = pd.read_csv(path, **kwargs).dropna(how="all").dropna(axis=1, how="all")
        except Exception:
            continue
        if best is None or candidate.shape[1] > best.shape[1]:
            best = candidate
    if best is None or best.empty:
        raise SystemExit(f"Could not read reference CSV: {path}")
    return best


def infer_column_by_values(df: pd.DataFrame, regex: re.Pattern[str], min_matches: int) -> str | None:
    best_col = None
    best_count = 0
    for column in df.columns:
        sample = df[column].dropna().astype(str).str.strip().head(500)
        count = sample.apply(lambda value: bool(regex.match(value))).sum()
        if count > best_count:
            best_col = column
            best_count = int(count)
    return best_col if best_count >= min_matches else None


def write_reference_report(path: Path, df: pd.DataFrame, practice_col: str | None, postcode_col: str | None, region_col: str | None) -> None:
    report = {
        "source": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "shape": [int(df.shape[0]), int(df.shape[1])],
        "detected": {
            "practice_code": practice_col,
            "postcode": postcode_col,
            "region": region_col,
        },
        "columns": [str(column) for column in df.columns[:80]],
        "sample_rows": df.head(5).fillna("").astype(str).to_dict(orient="records"),
    }
    (PROCESSED_DIR / "reference-column-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


def postcode_district(postcode: object) -> str | None:
    text = str(postcode).upper().replace(" ", "")
    match = POSTCODE_DISTRICT_RE.match(text)
    return match.group(1) if match else None


def write_report(source: Path, guesses: list[ColumnGuess]) -> None:
    report = {
        "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "guesses": [guess.__dict__ for guess in guesses],
        "note": "If automatic detection fails, use this report to update regex aliases in scripts/build-cover-areas.py.",
    }
    (PROCESSED_DIR / "cover-column-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
