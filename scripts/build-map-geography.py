#!/usr/bin/env python3
"""Build lightweight map geography from official ONS sources.

The source ONS Postcode Directory archive is intentionally not committed. Pass a
downloaded May 2026 archive with --onspd-zip; the generated public files are small
enough to ship with the site and are validated separately during normal builds.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path


ONSPD_EDITION = "May 2026"
ONSPD_SOURCE_URL = (
    "https://geoportal.statistics.gov.uk/datasets/"
    "6fff67d204fd4f339591ed667a6e3642"
)
ENGLAND_CODE = "E92000001"
BOUNDARY_SOURCE_URL = (
    "https://geoportal.statistics.gov.uk/datasets/"
    "818212ae5b2948bcb352842081c03762"
)
BOUNDARY_QUERY_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/"
    "Countries_December_2025_Boundaries_UK_BUC/FeatureServer/0/query"
    "?where=CTRY25CD%3D%27E92000001%27"
    "&outFields=CTRY25CD%2CCTRY25NM"
    "&returnGeometry=true&outSR=4326&geometryPrecision=4"
    "&maxAllowableOffset=0.01&f=geojson"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--onspd-zip", required=True, type=Path)
    parser.add_argument("--areas", type=Path, default=Path("public/data/areas.json"))
    parser.add_argument(
        "--centroids-output",
        type=Path,
        default=Path("data/reference/map-centroids.json"),
    )
    parser.add_argument(
        "--outline-output",
        type=Path,
        default=Path("public/data/england-outline.geojson"),
    )
    parser.add_argument(
        "--outline-source",
        type=Path,
        help="Optional cached GeoJSON response from the official ONS boundary query",
    )
    return parser.parse_args()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def load_target_districts(path: Path) -> set[str]:
    areas = json.loads(path.read_text(encoding="utf-8"))
    return {str(area["postcodeDistrict"]).upper() for area in areas}


def build_centroids(archive_path: Path, target_districts: set[str]) -> dict[str, object]:
    totals: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])

    with zipfile.ZipFile(archive_path) as archive:
        members = sorted(
            name
            for name in archive.namelist()
            if name.startswith("Data/multi_csv/") and name.lower().endswith(".csv")
        )
        if not members:
            raise RuntimeError("No ONSPD multi_csv files were found in the archive")

        for member in members:
            with archive.open(member) as raw:
                stream = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                for row in csv.DictReader(stream):
                    if row.get("doterm", "").strip():
                        continue
                    if row.get("ctry25cd", "").strip() != ENGLAND_CODE:
                        continue

                    district = row.get("pcds", "").strip().upper().split(" ", 1)[0]
                    # Keep all live England districts in the reference pool, so a
                    # refreshed COVER dataset can add a district without losing its map point.
                    if not district:
                        continue

                    try:
                        latitude = float(row["lat"])
                        longitude = float(row["long"])
                    except (KeyError, TypeError, ValueError):
                        continue

                    if not (49.0 <= latitude <= 56.5 and -7.5 <= longitude <= 2.5):
                        continue

                    totals[district][0] += longitude
                    totals[district][1] += latitude
                    totals[district][2] += 1

    missing = sorted(target_districts - totals.keys())
    if missing:
        raise RuntimeError(
            f"No live England postcode centroids found for {len(missing)} districts: "
            + ", ".join(missing[:30])
        )

    centroids = {
        district: {
            "longitude": round(values[0] / values[2], 6),
            "latitude": round(values[1] / values[2], 6),
            "postcodeUnitCount": int(values[2]),
        }
        for district, values in sorted(totals.items())
    }
    postcode_unit_count = sum(point["postcodeUnitCount"] for point in centroids.values())

    return {
        "metadata": {
            "title": "Postcode-district reference points for the Immunity Map explorer",
            "source": f"ONS Postcode Directory ({ONSPD_EDITION})",
            "sourceUrl": ONSPD_SOURCE_URL,
            "sourceUpdated": "2026-06-04",
            "licence": "Open Government Licence v3.0",
            "attribution": [
                "Contains OS data © Crown copyright and database right 2026",
                "Contains Royal Mail data © Royal Mail copyright and database right 2026",
                "Source: Office for National Statistics licensed under the Open Government Licence v.3.0",
            ],
            "coordinateReferenceSystem": "WGS84 (EPSG:4326)",
            "method": (
                "Arithmetic mean of the longitude and latitude of live England postcode-unit "
                "centroids within every outward postcode district with live England postcodes."
            ),
            "limitation": (
                "Each coordinate is a postcode-district reference point. It is not a district "
                "boundary, patient location, or exact GP-practice coordinate."
            ),
            "areaCount": len(centroids),
            "postcodeUnitCount": postcode_unit_count,
        },
        "centroids": centroids,
    }


def load_outline(source_path: Path | None) -> dict[str, object]:
    if source_path:
        outline = json.loads(source_path.read_text(encoding="utf-8"))
    else:
        request = urllib.request.Request(
            BOUNDARY_QUERY_URL,
            headers={"User-Agent": "ImmunityMap geography builder/1.0"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            outline = json.load(response)

    features = outline.get("features", [])
    if len(features) != 1 or features[0].get("properties", {}).get("CTRY25CD") != ENGLAND_CODE:
        raise RuntimeError("Official boundary response did not contain exactly one England feature")

    return {
        "type": "FeatureCollection",
        "metadata": {
            "title": "England country outline, ultra generalised and clipped",
            "source": "ONS Countries (December 2025) Boundaries UK BUC",
            "sourceUrl": BOUNDARY_SOURCE_URL,
            "licence": "Open Government Licence v3.0",
            "coordinateReferenceSystem": "WGS84 (EPSG:4326)",
            "generalisation": "0.01 degree maximum allowable offset for web display",
        },
        "features": features,
    }


def main() -> None:
    args = parse_args()
    targets = load_target_districts(args.areas)
    centroid_data = build_centroids(args.onspd_zip, targets)
    outline_data = load_outline(args.outline_source)

    write_json(args.centroids_output, centroid_data)
    write_json(args.outline_output, outline_data)
    print(
        f"Built {centroid_data['metadata']['areaCount']} postcode-district reference points "
        f"from {centroid_data['metadata']['postcodeUnitCount']:,} live postcode units."
    )
    print(f"Wrote {args.centroids_output} and {args.outline_output}.")


if __name__ == "__main__":
    main()
