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

const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const areas = JSON.parse(readFileSync(areasPath, 'utf8'));
const fallbackLastmod = toDateOnly(metadata.generatedAt) || toDateOnly(buildDate) || new Date().toISOString().slice(0, 10);

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
    // Town pages are generated from the area data and route template.
    paths.push(areasPath);
    paths.push(join('scripts', 'create-static-route-entrypoints.mjs'));
  }

  paths.push(htmlPathForRoute(route));
  paths.push(metadataPath);

  return [...new Set(paths)].filter(Boolean);
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
