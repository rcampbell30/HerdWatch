#!/usr/bin/env python3
"""Build Immunity Map area data from official COVER GP supplementary data.

The UKHSA/GOV.UK GP supplementary COVER workbook gives GP-level coverage values.
This script:
- detects the GP-level MMR1-at-24-months columns across changing workbook layouts;
- joins GP practice codes to ODS practice postcode reference data;
- derives the correct postcode district/outward code, e.g. M7 from M7 3XX, not M73;
- aggregates GP rows into Immunity Map's data/raw/areas.csv schema.

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
    parser = argparse.ArgumentParser(description="Build Immunity Map postcode-district area data from COVER GP ODS data.")
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

    workbook = pd.read_excel(source, sheet_name=None, engine="odf", header=None)
    sheet_name, frame, columns = find_cover_sheet(workbook)
    ref = load_reference(args.reference)

    data = pd.DataFrame(
        {
            "practice_code": frame[columns["practice_code"]],
            "total_eligible": frame[columns["denominator"]],
        }
    )
    if columns.get("coverage"):
        data["coverage"] = frame[columns["coverage"]]
    if columns.get("numerator"):
        data["total_vaccinated_source"] = frame[columns["numerator"]]
    if columns.get("region"):
        data["region"] = frame[columns["region"]]

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
    if "coverage" in data.columns:
        data["coverage"] = parse_percent(data["coverage"])
    if "total_vaccinated_source" in data.columns:
        data["total_vaccinated_source"] = pd.to_numeric(data["total_vaccinated_source"], errors="coerce")

    if "coverage" not in data.columns and "total_vaccinated_source" in data.columns:
        data["coverage"] = data["total_vaccinated_source"] / data["total_eligible"] * 100

    data = data.dropna(subset=["total_eligible", "coverage"])
    data = data[data["total_eligible"] > 0]
    data = data[(data["coverage"] >= 0) & (data["coverage"] <= 100)]

    if "total_vaccinated_source" in data.columns:
        valid_numerator = data["total_vaccinated_source"].notna() & (data["total_vaccinated_source"] >= 0) & (data["total_vaccinated_source"] <= data["total_eligible"] * 1.05)
        if valid_numerator.mean() >= 0.8:
            data["total_vaccinated"] = data["total_vaccinated_source"].round()
        else:
            data["total_vaccinated"] = (data["total_eligible"] * data["coverage"] / 100).round()
    else:
        # GP supplementary files often expose denominator + percentage, not a clean numerator.
        # Reconstruct an approximate vaccinated count so Immunity Map can aggregate and display counts.
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

    # If one outward code has GP practices crossing ICB regions, collapse to one Immunity Map row.
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
    print(f"Using practice_code={columns['practice_code']!r}, denominator={columns['denominator']!r}, coverage={columns.get('coverage')!r}, numerator={columns.get('numerator')!r}.")
    print("Vaccinated counts reconstructed or read from numerator depending on available COVER columns.")
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
        if "2025-to-2026" in name or "2025-2026" in name:
            value += 200
        if "q4" in name or "january-to-march-2026" in name or "jan-to-mar-2026" in name:
            value += 80
        if "annual" in name:
            value -= 20
        if "data-tables" in name or "data_tables" in name:
            value -= 80
        return value, name

    return sorted(files, key=score, reverse=True)[0]


def find_cover_sheet(workbook: dict[str, pd.DataFrame]) -> tuple[str, pd.DataFrame, dict[str, str]]:
    guesses = []
    for sheet_name, raw in workbook.items():
        frame, header_report = normalise_frame(raw)
        columns = detect_columns(frame)
        score = score_detected_columns(columns)
        guesses.append(
            {
                "sheet": sheet_name,
                "score": score,
                "header": header_report,
                "columns": columns,
                "all_columns": list(frame.columns)[:120],
                "sample_rows": frame.head(3).fillna("").astype(str).to_dict(orient="records"),
            }
        )

    guesses.sort(key=lambda item: item["score"], reverse=True)
    (PROCESSED_DIR / "cover-column-report.json").write_text(json.dumps({"guesses": guesses}, indent=2), encoding="utf-8")

    best = guesses[0] if guesses else None
    has_required = best and best["columns"].get("practice_code") and best["columns"].get("denominator") and (best["columns"].get("coverage") or best["columns"].get("numerator"))
    if not has_required:
        raise SystemExit(
            "Could not detect GP code, denominator and MMR1 coverage/numerator columns. "
            "See data/processed/cover-column-report.json."
        )

    frame, _ = normalise_frame(workbook[best["sheet"]], preferred_header=best["header"].get("bottomRowIndex"))
    return best["sheet"], frame, best["columns"]


def score_detected_columns(columns: dict[str, str | None]) -> int:
    score = 0
    if columns.get("practice_code"):
        score += 20
    if columns.get("denominator"):
        score += 20
    if columns.get("coverage"):
        score += 20
    if columns.get("numerator"):
        score += 12
    if columns.get("region"):
        score += 4
    return score


def normalise_frame(df: pd.DataFrame, preferred_header: int | None = None) -> tuple[pd.DataFrame, dict[str, object]]:
    df = df.dropna(how="all").dropna(axis=1, how="all").copy()
    if df.empty:
        return df, {"bottomRowIndex": 0, "headerRows": [0], "score": 0}

    if preferred_header is not None:
        bottom = min(preferred_header, len(df) - 1)
        start = max(0, bottom - 2)
        return frame_from_header(df, list(range(start, bottom + 1))), {"bottomRowIndex": bottom, "headerRows": list(range(start, bottom + 1)), "score": None}

    best = {"score": -1, "bottomRowIndex": 0, "headerRows": [0]}
    max_scan = min(80, len(df))
    for bottom in range(max_scan):
        for start in range(max(0, bottom - 2), bottom + 1):
            header_rows = list(range(start, bottom + 1))
            headers = build_headers(df, header_rows)
            score = header_score(headers)
            non_empty = sum(bool(h) for h in headers)
            if non_empty < 4:
                continue
            score -= bottom * 0.05
            if score > best["score"]:
                best = {"score": score, "bottomRowIndex": bottom, "headerRows": header_rows}

    frame = frame_from_header(df, best["headerRows"])
    return frame, best


def frame_from_header(df: pd.DataFrame, header_rows: list[int]) -> pd.DataFrame:
    headers = build_headers(df, header_rows)
    out = df.iloc[max(header_rows) + 1 :].copy()
    out.columns = dedupe([header or f"col_{i}" for i, header in enumerate(headers)])
    return out.dropna(how="all")


def build_headers(df: pd.DataFrame, header_rows: list[int]) -> list[str]:
    headers = []
    for col in df.columns:
        parts = []
        for row in header_rows:
            value = df.at[row, col]
            text = normalise_col(value)
            if text and text != "nan" and text not in parts:
                parts.append(text)
        headers.append(" ".join(parts))
    return headers


def header_score(headers: list[str]) -> float:
    joined = " | ".join(headers)
    score = 0.0
    score += 14 if re.search(r"\bgp\s*code\b|\bgpcode\b|practice.*code|organisation.*code|ods.*code", joined, re.I) else 0
    score += 12 if re.search(r"denom|eligible|cohort|children.*(?:24 months|2 years)|(?:reached|reaching).*24 months", joined, re.I) else 0
    score += 12 if re.search(r"mmr|measles", joined, re.I) and re.search(r"coverage|percentage|percent|%|rate", joined, re.I) else 0
    score += 6 if re.search(r"24 months|2 years|two years", joined, re.I) else 0
    score += 4 if re.search(r"icb|region|nhs england", joined, re.I) else 0
    score += min(8, len([h for h in headers if h]) / 5)
    return score


def detect_columns(frame: pd.DataFrame) -> dict[str, str | None]:
    columns = list(frame.columns)
    detected = {
        "practice_code": best_column(
            columns,
            positives=[
                (r"\bgp\s*code\b|\bgpcode\b", 14),
                (r"practice.*code|code.*practice", 10),
                (r"organisation.*code|organization.*code|ods.*code|provider.*code", 7),
                (r"\bcode\b", 2),
            ],
            negatives=[(r"icb|sub\s*icb|region|nhs england|local authority|postcode|name", 8)],
            min_score=6,
        ),
        "denominator": best_column(
            columns,
            positives=[
                (r"denom|eligible|cohort", 10),
                (r"number.*children|children.*number", 5),
                (r"reached|reaching|aged|age|turning", 4),
                (r"24\s*months?|2\s*years?|two\s*years?", 6),
            ],
            negatives=[(r"coverage|percentage|percent|%|rate", 12), (r"mmr|measles|vaccinat|immunis", 7), (r"5\s*years?|60\s*months?|second|dose\s*2|mmr2", 10)],
            min_score=8,
        ),
        "coverage": best_column(
            columns,
            positives=[
                (r"coverage|percentage|percent|%|rate", 10),
                (r"mmr\s*1|mmr1|dose\s*1|first\s*dose|one\s*dose", 7),
                (r"mmr|measles", 4),
                (r"24\s*months?|2\s*years?|two\s*years?", 4),
            ],
            negatives=[(r"mmr\s*2|mmr2|dose\s*2|second\s*dose|5\s*years?|60\s*months?", 12), (r"denom|eligible|cohort|number.*children|reached|reaching", 6)],
            min_score=10,
        ),
        "numerator": best_column(
            columns,
            positives=[
                (r"numerator|vaccinated|received|given|immunised|immunized", 7),
                (r"number", 3),
                (r"mmr\s*1|mmr1|dose\s*1|first\s*dose|one\s*dose", 7),
                (r"mmr|measles", 4),
                (r"24\s*months?|2\s*years?|two\s*years?", 3),
            ],
            negatives=[(r"coverage|percentage|percent|%|rate", 12), (r"denom|eligible|cohort|reached|reaching", 8), (r"mmr\s*2|mmr2|dose\s*2|second\s*dose|5\s*years?|60\s*months?", 12)],
            min_score=10,
        ),
        "region": best_column(
            columns,
            positives=[(r"^icb name$|\bicb\b.*name", 8), (r"nhs england region|ukhsa region|region", 6), (r"sub\s*icb.*name", 5)],
            negatives=[(r"code|postcode", 5)],
            min_score=5,
        ),
    }

    if detected["practice_code"] is None:
        detected["practice_code"] = infer_column_by_values(frame, PRACTICE_CODE_RE, min_matches=20)

    return detected


def best_column(columns: list[str], positives: list[tuple[str, int]], negatives: list[tuple[str, int]] | None = None, min_score: int = 1) -> str | None:
    best_name = None
    best_score = min_score - 1
    for column in columns:
        text = normalise_col(column)
        score = 0
        for pattern, weight in positives:
            if re.search(pattern, text, re.I):
                score += weight
        for pattern, weight in negatives or []:
            if re.search(pattern, text, re.I):
                score -= weight
        if score > best_score:
            best_name = column
            best_score = score
    return best_name


def parse_percent(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(
        series.astype(str).str.replace("%", "", regex=False).str.replace("*", "", regex=False).str.strip(),
        errors="coerce",
    )
    positive = values[(values > 0) & values.notna()]
    if not positive.empty and positive.median() <= 1:
        values = values * 100
    return values


def normalise_col(value: object) -> str:
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower()).replace("\n", " ")


def dedupe(columns: Iterable[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for column in columns:
        count = seen.get(column, 0)
        seen[column] = count + 1
        out.append(column if count == 0 else f"{column}_{count + 1}")
    return out


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


def infer_column_by_values(df: pd.DataFrame, regex: re.Pattern[str], min_matches: int) -> str | None:
    best_col = None
    best_count = 0
    for column in df.columns:
        sample = df[column].dropna().astype(str).str.strip().head(1200)
        count = int(sample.apply(lambda value: bool(regex.match(value))).sum())
        if count > best_count:
            best_col = column
            best_count = count
    return str(best_col) if best_count >= min_matches else None


def postcode_district(postcode: object) -> str | None:
    text = str(postcode).upper().replace(" ", "")
    match = FULL_POSTCODE_RE.match(text)
    return match.group(1) if match else None


def write_import_report(source: Path, sheet_name: str, columns: dict[str, str | None], raw_rows: int, area_rows: int, missing_postcode: int) -> None:
    report = {
        "source": str(source.relative_to(ROOT)) if source.is_relative_to(ROOT) else str(source),
        "sheet": sheet_name,
        "columns": columns,
        "rawRows": raw_rows,
        "areaRows": area_rows,
        "missingPostcodeMatches": missing_postcode,
        "note": "Vaccinated counts are read from a numerator column where available, otherwise reconstructed from denominator × coverage because GP supplementary workbooks can expose percentages without a clean MMR1 numerator column.",
    }
    (PROCESSED_DIR / "cover-import-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
