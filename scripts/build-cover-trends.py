#!/usr/bin/env python3
from pathlib import Path
import csv, json, re
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data' / 'raw' / 'source'
OUT = ROOT / 'data' / 'raw' / 'trends.csv'
REPORT = ROOT / 'data' / 'processed' / 'cover-trend-report.json'
YEAR_RE = re.compile(r'(20\d{2})[-_ ]?(?:to)?[-_ ]?(20\d{2})')

def ncol(x):
    return re.sub(r'\s+', ' ', str(x).strip().lower()).replace('\n', ' ')

def dedupe(cols):
    seen, out = {}, []
    for c in cols:
        n = seen.get(c, 0)
        seen[c] = n + 1
        out.append(c if n == 0 else f'{c}_{n+1}')
    return out

def norm(df):
    df = df.dropna(how='all').dropna(axis=1, how='all')
    best, score = 0, -1
    for i in range(min(12, len(df))):
        joined = ' '.join(ncol(v) for v in df.iloc[i].tolist())
        s = sum(k in joined for k in ['mmr1','mmr2','coverage','reached 24 months','reached 5 years'])
        if s > score:
            best, score = i, s
    out = df.iloc[best+1:].copy()
    out.columns = dedupe([ncol(v) or f'col_{i}' for i, v in enumerate(df.iloc[best].tolist())])
    return out.dropna(how='all')

def fcol(cols, pats):
    for p in pats:
        r = re.compile(p, re.I)
        for c in cols:
            if r.search(str(c)):
                return c
    return None

def pct(s):
    return pd.to_numeric(s.astype(str).str.replace('%','', regex=False).str.replace('*','', regex=False), errors='coerce')

def wavg(vals, weights):
    ok = vals.notna() & weights.notna() & (weights > 0)
    if not ok.any():
        raise RuntimeError('no valid weighted rows')
    return float((vals[ok] * weights[ok]).sum() / weights[ok].sum())

def period(name):
    name = name.lower().replace('_','-')
    m = YEAR_RE.search(name)
    if not m:
        return None
    a, b = m.group(1), m.group(2)
    return {'year': f'{a}-{b[-2:]}', 'sort': int(a)}

def annual_files():
    files = []
    for p in SRC.glob('*.ods'):
        n = p.name.lower()
        is_annual = 'annual' in n or any(y in n for y in ['2020-to-2021','2021-to-2022','2022-to-2023','2023-2024'])
        is_gp = 'gp' in n and ('supplementary' in n or 'cover-gp-annual' in n)
        if is_annual and is_gp:
            files.append(p)
    return sorted(files, key=lambda p: p.name)

def extract(path):
    wb = pd.read_excel(path, sheet_name=None, engine='odf')
    guesses = []
    for sheet, raw in wb.items():
        df = norm(raw)
        cols = list(df.columns)
        found = {
            'den24': fcol(cols, [r'^number of children who reached 24 months$', r'children.*reached.*24 months', r'reached.*24 months']),
            'mmr1': fcol(cols, [r'^coverage at 24 months mmr1 \(%\)$', r'coverage.*24 months.*mmr1', r'mmr1.*24.*cover']),
            'den5': fcol(cols, [r'^number of children who reached 5 years$', r'children.*reached.*5 years', r'reached.*5 years']),
            'mmr2': fcol(cols, [r'^coverage at 5 years mmr2 \(%\)$', r'coverage.*5 years.*mmr2', r'mmr2.*5.*cover'])
        }
        score = sum(bool(v) for v in found.values()) + (10 if all(found.values()) else 0)
        guesses.append((score, sheet, df, found, cols[:40]))
    guesses.sort(reverse=True, key=lambda x: x[0])
    score, sheet, df, c, sample = guesses[0]
    if not all(c.values()):
        raise RuntimeError({'file': path.name, 'best': c, 'columns': sample})
    row = period(path.name)
    if row is None:
        raise RuntimeError(f'Could not infer period from {path.name}')
    den24 = pd.to_numeric(df[c['den24']], errors='coerce')
    den5 = pd.to_numeric(df[c['den5']], errors='coerce')
    row['england_mmr1'] = round(wavg(pct(df[c['mmr1']]), den24), 1)
    row['england_mmr2'] = round(wavg(pct(df[c['mmr2']]), den5), 1)
    row['target'] = 95
    return row, {'file': str(path.relative_to(ROOT)), 'sheet': sheet, 'columns': c}

def main():
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    rows, reports = [], []
    for p in annual_files():
        try:
            row, rep = extract(p)
            rows.append(row)
            reports.append(rep)
        except Exception as e:
            reports.append({'file': str(p.relative_to(ROOT)), 'error': str(e)})
    if not rows:
        REPORT.write_text(json.dumps({'files': reports}, indent=2), encoding='utf-8')
        raise SystemExit('No trend rows extracted. See data/processed/cover-trend-report.json')
    rows = sorted({r['year']: r for r in rows}.values(), key=lambda r: r['sort'])
    with OUT.open('w', newline='', encoding='utf-8') as h:
        w = csv.DictWriter(h, fieldnames=['year','england_mmr1','england_mmr2','target'])
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in ['year','england_mmr1','england_mmr2','target']})
    REPORT.write_text(json.dumps({'method':'Weighted from official annual GP supplementary COVER files', 'rows': rows, 'files': reports}, indent=2), encoding='utf-8')
    print(f'Wrote {len(rows)} trend rows to {OUT.relative_to(ROOT)}')

if __name__ == '__main__':
    main()
