#!/usr/bin/env python3
"""Build place-name aliases from active NHS ODS GP address towns (not patient locations)."""
import argparse
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build(reference, output):
    districts = {a['postcodeDistrict'] for a in json.loads((ROOT / 'src/data/generated/areas.json').read_text())}
    places = {district: set() for district in districts}
    with reference.open(newline='', encoding='utf-8-sig') as handle:
        for row in csv.reader(handle):
            # epraccur layout: address town = 8th field, postcode = 10th, status = 13th.
            if len(row) != 27:
                raise ValueError('Unexpected epraccur layout; review address columns before rebuilding search.')
            if row[12].strip().upper() != 'ACTIVE':
                continue
            match = re.fullmatch(r'([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}', row[9].strip().upper())
            town = row[7].strip()
            if match and match[1] in places and town:
                places[match[1]].add(town.title())
    aliases = {key: sorted(value) for key, value in sorted(places.items()) if value}
    if len(aliases) < len(districts) * 0.8:
        raise ValueError('Too few postcode districts have place names; retain the existing index and review the source.')
    output.write_text(json.dumps(aliases, indent=2, ensure_ascii=False) + '\n')
    print(f'Built GP address town aliases for {len(aliases)} districts.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference', type=Path, default=ROOT / 'data/raw/ref/epraccur.csv')
    parser.add_argument('--out', type=Path, default=ROOT / 'src/data/generated/search-places.json')
    args = parser.parse_args()
    build(args.reference, args.out)
