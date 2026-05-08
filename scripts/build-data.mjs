import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rawDir = path.join(root, 'data', 'raw');
const generatedDir = path.join(root, 'src', 'data', 'generated');
const publicDataDir = path.join(root, 'public', 'data');
const reportPath = path.join(root, 'data', 'processed', 'data-report.json');

const areaCsvPath = firstExisting([
  path.join(rawDir, 'areas.csv'),
  path.join(rawDir, 'areas.example.csv')
]);

const trendCsvPath = firstExisting([
  path.join(rawDir, 'trends.csv'),
  path.join(rawDir, 'trends.example.csv')
]);

const usingExampleData = areaCsvPath.endsWith('.example.csv') || trendCsvPath.endsWith('.example.csv');

fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(publicDataDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const rawAreas = parseCsv(fs.readFileSync(areaCsvPath, 'utf8')).map(normaliseAreaRow);
const { areas, duplicatePostcodeDistricts } = aggregateDuplicateAreas(rawAreas);
const trends = parseCsv(fs.readFileSync(trendCsvPath, 'utf8')).map(normaliseTrendRow);

validateAreas(areas);
validateTrends(trends);

const metadata = {
  generatedAt: new Date().toISOString(),
  usingExampleData,
  sourceFiles: {
    areas: path.relative(root, areaCsvPath),
    trends: path.relative(root, trendCsvPath)
  },
  rawAreaRowCount: rawAreas.length,
  areaCount: areas.length,
  duplicatePostcodeDistrictCount: duplicatePostcodeDistricts.length,
  trendPointCount: trends.length,
  statusCounts: countBy(areas, 'status'),
  coverageBands: {
    atRisk: 'coverage < 90',
    vulnerable: '90 <= coverage < 95',
    protected: 'coverage >= 95'
  }
};

writeJson(path.join(generatedDir, 'areas.json'), areas);
writeJson(path.join(generatedDir, 'trends.json'), trends);
writeJson(path.join(publicDataDir, 'areas.json'), areas);
writeJson(path.join(publicDataDir, 'trends.json'), trends);
writeJson(path.join(publicDataDir, 'metadata.json'), metadata);

const report = {
  ...metadata,
  duplicatePostcodeDistricts: duplicatePostcodeDistricts.slice(0, 50),
  lowestCoverage: [...areas].sort((a, b) => a.coverage - b.coverage).slice(0, 10).map((area) => ({
    postcodeDistrict: area.postcodeDistrict,
    coverage: area.coverage,
    status: area.status
  })),
  notes: [
    'Use data/raw/areas.csv and data/raw/trends.csv for real NHS COVER imports.',
    'Example CSVs are used automatically only when real raw files are absent.',
    'The app and static map route can read public/data/areas.json after build.',
    'Duplicate postcode districts are aggregated by summing eligible/vaccinated/practice counts and recalculating coverage.',
    'Coverage bands: below 90 = AT_RISK; 90 to below 95 = VULNERABLE; 95+ = PROTECTED.'
  ]
};

writeJson(reportPath, report);
console.log(`Built ${areas.length} areas and ${trends.length} trend points.`);
if (duplicatePostcodeDistricts.length) {
  console.warn(`Aggregated ${duplicatePostcodeDistricts.length} duplicate postcode districts.`);
}
console.log(`Public data written to ${path.relative(root, publicDataDir)}.`);
console.log(`Wrote ${path.relative(root, reportPath)}.`);
if (usingExampleData) {
  console.warn('Warning: using example data. Add real NHS COVER files as data/raw/areas.csv and data/raw/trends.csv.');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

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

function aggregateDuplicateAreas(rows) {
  const byPostcode = new Map();

  for (const row of rows) {
    const current = byPostcode.get(row.postcodeDistrict);
    if (!current) {
      byPostcode.set(row.postcodeDistrict, {
        postcodeDistrict: row.postcodeDistrict,
        regions: new Set([row.region]),
        practiceCount: row.practiceCount,
        totalEligible: row.totalEligible,
        totalVaccinated: row.totalVaccinated,
        rowCount: 1
      });
      continue;
    }

    current.regions.add(row.region);
    current.practiceCount += row.practiceCount;
    current.totalEligible += row.totalEligible;
    current.totalVaccinated += row.totalVaccinated;
    current.rowCount += 1;
  }

  const duplicatePostcodeDistricts = [];
  const areas = [...byPostcode.values()].map((item) => {
    const regions = [...item.regions].sort();
    if (item.rowCount > 1) {
      duplicatePostcodeDistricts.push({
        postcodeDistrict: item.postcodeDistrict,
        rows: item.rowCount,
        regions
      });
    }

    const coverage = round((item.totalVaccinated / item.totalEligible) * 100, 1);
    return {
      postcodeDistrict: item.postcodeDistrict,
      region: regions.length === 1 ? regions[0] : 'Multiple regions',
      practiceCount: item.practiceCount,
      coverage,
      totalEligible: item.totalEligible,
      totalVaccinated: item.totalVaccinated,
      status: statusFromCoverage(coverage)
    };
  }).sort((a, b) => a.coverage - b.coverage || a.postcodeDistrict.localeCompare(b.postcodeDistrict));

  return { areas, duplicatePostcodeDistricts };
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
      throw new Error(`Duplicate postcode district after aggregation: ${area.postcodeDistrict}`);
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
