#!/usr/bin/env python3
"""Netlify wrapper for the COVER area importer.

The main importer is intentionally flexible because UKHSA COVER workbooks change layout.
This wrapper fixes pandas headerless CSV column inference by preserving positional
column keys (for example 0 and 9) instead of converting them to strings.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMPORTER_PATH = ROOT / "scripts" / "build-cover-areas.py"

spec = importlib.util.spec_from_file_location("cover_area_importer", IMPORTER_PATH)
if spec is None or spec.loader is None:
    raise SystemExit(f"Could not load importer: {IMPORTER_PATH}")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def infer_column_by_values_preserving_key(df, regex, min_matches):
    best_col = None
    best_count = 0
    for column in df.columns:
        sample = df[column].dropna().astype(str).str.strip().head(1200)
        count = int(sample.apply(lambda value: bool(regex.match(value))).sum())
        if count > best_count:
            best_col = column
            best_count = count
    return best_col if best_count >= min_matches else None


module.infer_column_by_values = infer_column_by_values_preserving_key
module.main()
