import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const distDir = 'dist';
const baseUrl = normaliseBaseUrl(process.env.SITE_URL || 'https://immunitymap.netlify.app');
const buildDate = new Date();

if (!existsSync(distDir)) {
  throw new Error('dist/ does not exist. Run vite build before creating sitemap.xml.');
}

const metadataPath = firstExisting([
  join(distDir, 'data', 'metadata.json'),
  join('public', 'data', 'metadata.json')
]);
const areasPath = firstExisting([
  join(distDir, 'data', 'areas.json'),
  join('public', 'data', 'areas.json')
]);
const rawAreaCsvPath = firstExisting([
  join('data', 'raw', 'areas.csv'),
  join('data', 'raw', 'areas.example.csv'),
  areasPath
]);

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const areas = JSON.parse(readFileSync(areasPath, 'utf8'));
const fallbackLastmod = toDateOnly(metadata.generatedAt) || toDateOnly(buildDate) || new Date().toISOString().slice(0, 10);
const areaSourceLineByPostcode = rawAreaCsvPath.endsWith('.csv')
  ? buildAreaSourceLineMap(readFileSync(rawAreaCsvPath, 'utf8'))
  : new Map();
const areaByPostcode = new Map(
  areas.map((area) => [String(area.postcodeDistrict).toUpperCase(), area])
);

const coreRoutes = [
  '/',
  '/towns/',
  '/map/',
  '/myths/',
  '/wakefield/',
  '/methodology/'
];

const townRoutes = areas
  .map((area) => `/town/${String(area.postcodeDistrict).toLowerCase()}/`)
  .sort((a, b) => a.localeCompare(b));

const routes = [...coreRoutes, ...townRoutes];
const urls = routes.map((route) => buildSitemapEntry(route));

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(renderUrl),
  '</urlset>',
  ''
].join('\n');

writeFileSync(join(distDir, 'sitemap.xml'), xml, 'utf8');
console.log(`Created sitemap.xml with ${urls.length.toLocaleString()} URLs for ${baseUrl}.`);

function buildSitemapEntry(route) {
  return {
    loc: `${baseUrl}${route}`,
    lastmod: getLastmodForRoute(route),
    changefreq: getChangefreq(route),
    priority: getPriority(route)
  };
}

function renderUrl({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`;
}

function getLastmodForRoute(route) {
  if (route.startsWith('/town/')) {
    const townLastmod = getTownLastmod(route);
    if (townLastmod) return townLastmod;
  }

  const candidatePaths = getLastmodCandidatePaths(route);

  for (const candidate of candidatePaths) {
    const gitDate = getGitLastModifiedDate(candidate);
    if (gitDate) return gitDate;
  }

  for (const candidate of candidatePaths) {
    const fsDate = getFileModifiedDate(candidate);
    if (fsDate) return fsDate;
  }

  return fallbackLastmod;
}

function getTownLastmod(route) {
  const postcodeDistrict = getTownPostcodeDistrict(route);
  if (!postcodeDistrict) return null;

  const area = areaByPostcode.get(postcodeDistrict);
  const embeddedDate = getAreaEmbeddedLastmod(area);
  if (embeddedDate) return embeddedDate;

  const sourceLine = areaSourceLineByPostcode.get(postcodeDistrict);
  if (sourceLine) {
    // Prefer line-level git history for the exact postcode row in data/raw/areas.csv.
    // This is more accurate than using the mtime for the whole CSV, which makes every
    // generated /town/ page share the same <lastmod> date.
    const lineDate = getGitLineLastModifiedDate(rawAreaCsvPath, sourceLine);
    if (lineDate) return lineDate;

    const grepDate = getGitPatternLastModifiedDate(rawAreaCsvPath, `^${escapeRegExp(postcodeDistrict)},`);
    if (grepDate) return grepDate;
  }

  const specificCandidates = [
    join('public', 'town', postcodeDistrict.toLowerCase(), 'index.html'),
    join('src', 'town', postcodeDistrict.toLowerCase(), 'index.html'),
    htmlPathForRoute(route)
  ];

  for (const candidate of specificCandidates) {
    const gitDate = getGitLastModifiedDate(candidate);
    if (gitDate) return gitDate;
  }

  for (const candidate of specificCandidates) {
    const fsDate = getFileModifiedDate(candidate);
    if (fsDate) return fsDate;
  }

  return null;
}

function getTownPostcodeDistrict(route) {
  const match = route.match(/^\/town\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]).toUpperCase() : null;
}

function getAreaEmbeddedLastmod(area) {
  if (!area || typeof area !== 'object') return null;
  const possibleFields = [
    'lastmod',
    'lastModified',
    'last_modified',
    'updatedAt',
    'updated_at',
    'sourceUpdatedAt',
    'source_updated_at'
  ];

  for (const field of possibleFields) {
    const value = area[field];
    const date = toDateOnly(value);
    if (date) return date;
  }

  return null;
}

function getLastmodCandidatePaths(route) {
  const paths = [];

  // Prefer source/static files where they exist because dist files are regenerated
  // during every build and can otherwise make every URL look modified today.
  if (route === '/') {
    paths.push('index.html');
  } else {
    const cleanParts = route.split('/').filter(Boolean);
    paths.push(join('public', ...cleanParts, 'index.html'));
    paths.push(join('src', ...cleanParts));
  }

  if (route.startsWith('/town/')) {
    // Town pages are generated from the area data and route template. This branch is
    // now only a fallback because getTownLastmod() first tries row-level source dates.
    paths.push(areasPath);
    paths.push(rawAreaCsvPath);
    paths.push(join('scripts', 'create-static-route-entrypoints.mjs'));
  }

  paths.push(htmlPathForRoute(route));
  paths.push(metadataPath);

  return [...new Set(paths)].filter(Boolean);
}

function buildAreaSourceLineMap(csv) {
  const map = new Map();
  const lines = String(csv).split(/\r?\n/);

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const postcodeDistrict = getFirstCsvCell(line).replace(/^\uFEFF/, '').trim().toUpperCase();
    if (!postcodeDistrict || map.has(postcodeDistrict)) continue;
    map.set(postcodeDistrict, index + 1);
  }

  return map;
}

function getFirstCsvCell(line) {
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) break;
    cell += char;
  }

  return cell;
}

function getGitLastModifiedDate(path) {
  try {
    if (!existsSync(path)) return null;
    const output = execFileSync('git', ['log', '-1', '--format=%cI', '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return toDateOnly(output);
  } catch {
    return null;
  }
}

function getGitLineLastModifiedDate(path, lineNumber) {
  try {
    if (!existsSync(path)) return null;
    const output = execFileSync('git', ['log', '-1', '--format=%cI', '-L', `${lineNumber},${lineNumber}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return toDateOnly(extractFirstIsoDate(output));
  } catch {
    return null;
  }
}

function getGitPatternLastModifiedDate(path, pattern) {
  try {
    if (!existsSync(path)) return null;
    const output = execFileSync('git', ['log', '-1', '--format=%cI', '-G', pattern, '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return toDateOnly(extractFirstIsoDate(output));
  } catch {
    return null;
  }
}

function extractFirstIsoDate(value) {
  return String(value).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/)?.[0] || null;
}

function getFileModifiedDate(path) {
  try {
    if (!existsSync(path)) return null;
    return toDateOnly(statSync(path).mtime);
  } catch {
    return null;
  }
}

function getChangefreq(route) {
  if (route === '/') return 'daily';
  if (route.startsWith('/town/')) return 'monthly';
  if (isTopLevelRoute(route)) return 'weekly';
  return 'monthly';
}

function getPriority(route) {
  if (route === '/') return '1.0';
  if (route.startsWith('/town/')) return '0.6';
  if (isTopLevelRoute(route)) return '0.8';
  return '0.5';
}

function isTopLevelRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 1;
}

function htmlPathForRoute(route) {
  if (route === '/') return join(distDir, 'index.html');
  return join(distDir, ...route.split('/').filter(Boolean), 'index.html');
}

function firstExisting(paths) {
  const found = paths.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`No file found. Checked: ${paths.join(', ')}`);
  }
  return found;
}

function normaliseBaseUrl(value) {
  return String(value).replace(/\/$/, '');
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
