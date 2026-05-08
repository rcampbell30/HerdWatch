import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rawDir = path.join(root, 'data', 'raw');
const generatedDir = path.join(root, 'src', 'data', 'generated');
const reportPath = path.join(root, 'data', 'processed', 'data-report.json');

const areaCsvPath = firstExisting([
  path.join(rawDir, 'areas.csv'),
  path.join(rawDir, 'areas.example.csv')
]);

const trendCsvPath = firstExisting([
  path.join(rawDir, 'trends.csv'),
  path.join(rawDir, 'trends.example.csv')
]);

fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const areas = parseCsv(fs.readFileSync(areaCsvPath, 'utf8')).map(normaliseAreaRow);
const trends = parseCsv(fs.readFileSync(trendCsvPath, 'utf8')).map(normaliseTrendRow);

validateAreas(areas);
validateTrends(trends);

fs.writeFileSync(path.join(generatedDir, 'areas.json'), JSON.stringify(areas, null, 2) + '\n');
fs.writeFileSync(path.join(generatedDir, 'trends.json'), JSON.stringify(trends, null, 2) + '\n');

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: {
    areas: path.relative(root, areaCsvPath),
    trends: path.relative(root, trendCsvPath)
  },
  areaCount: areas.length,
  trendPointCount: trends.length,
  statusCounts: countBy(areas, 'status'),
  lowestCoverage: [...areas].sort((a, b) => a.coverage - b.coverage).slice(0, 10).map((area) => ({
    postcodeDistrict: area.postcodeDistrict,
    coverage: area.coverage,
    status: area.status
  })),
  notes: [
    'Use data/raw/areas.csv and data/raw/trends.csv for real NHS COVER imports.',
    'Example CSVs are used automatically only when real raw files are absent.',
    'Coverage bands: below 90 = AT_RISK; 90 to below 95 = VULNERABLE; 95+ = PROTECTED.'
  ]
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Built ${areas.length} areas and ${trends.length} trend points.`);
console.log(`Wrote ${path.relative(root, reportPath)}.`);

function firstExisting(paths) {
  const found = paths.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No input file found. Checked: ${paths.join(', ')}`);
  }
  return found;
}

function parseCsv(input) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => normaliseHeader(header));

  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? '';
    });
    return record;
  });
}

function normaliseHeader(header) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normaliseAreaRow(row) {
  const totalEligible = toInteger(row.total_eligible ?? row.eligible ?? row.denominator, 'total_eligible');
  const totalVaccinated = toInteger(row.total_vaccinated ?? row.vaccinated ?? row.numerator, 'total_vaccinated');
  const coverage = row.coverage === '' || row.coverage == null
    ? round((totalVaccinated / totalEligible) * 100, 1)
    : toNumber(row.coverage, 'coverage');

  return {
    postcodeDistrict: required(row.postcode_district ?? row.postcode ?? row.area, 'postcode_district').toUpperCase(),
    region: required(row.region ?? 'Other', 'region'),
    practiceCount: toInteger(row.practice_count ?? row.practices ?? 0, 'practice_count'),
    coverage: round(coverage, 1),
    totalEligible,
    totalVaccinated,
    status: statusFromCoverage(coverage)
  };
}

function normaliseTrendRow(row) {
  return {
    year: required(row.year ?? row.period, 'year'),
    englandMmr1: round(toNumber(row.england_mmr1 ?? row.mmr1 ?? row.mmr1_coverage, 'england_mmr1'), 1),
    englandMmr2: round(toNumber(row.england_mmr2 ?? row.mmr2 ?? row.mmr2_coverage, 'england_mmr2'), 1),
    target: round(toNumber(row.target ?? 95, 'target'), 1)
  };
}

function validateAreas(areas) {
  const seen = new Set();
  for (const area of areas) {
    if (seen.has(area.postcodeDistrict)) {
      throw new Error(`Duplicate postcode district: ${area.postcodeDistrict}`);
    }
    seen.add(area.postcodeDistrict);
    if (area.totalVaccinated > area.totalEligible) {
      throw new Error(`${area.postcodeDistrict}: total_vaccinated cannot exceed total_eligible.`);
    }
    if (area.coverage < 0 || area.coverage > 100) {
      throw new Error(`${area.postcodeDistrict}: coverage must be 0–100.`);
    }
  }
}

function validateTrends(trends) {
  if (trends.length === 0) {
    throw new Error('Trend data cannot be empty.');
  }
  for (const trend of trends) {
    for (const key of ['englandMmr1', 'englandMmr2', 'target']) {
      if (trend[key] < 0 || trend[key] > 100) {
        throw new Error(`${trend.year}: ${key} must be 0–100.`);
      }
    }
  }
}

function statusFromCoverage(coverage) {
  if (coverage < 90) return 'AT_RISK';
  if (coverage < 95) return 'VULNERABLE';
  return 'PROTECTED';
}

function required(value, name) {
  if (value == null || String(value).trim() === '') {
    throw new Error(`Missing required field: ${name}`);
  }
  return String(value).trim();
}

function toInteger(value, name) {
  const number = Number.parseInt(String(value).replace(/,/g, ''), 10);
  if (!Number.isFinite(number)) throw new Error(`Invalid integer for ${name}: ${value}`);
  return number;
}

function toNumber(value, name) {
  const number = Number.parseFloat(String(value).replace('%', '').replace(/,/g, ''));
  if (!Number.isFinite(number)) throw new Error(`Invalid number for ${name}: ${value}`);
  return number;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}
