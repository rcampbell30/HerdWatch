import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const baseUrl = normaliseBaseUrl(process.env.SITE_URL || process.env.URL || 'https://herdwatch.netlify.app');

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
const lastmod = toDateOnly(metadata.generatedAt) || new Date().toISOString().slice(0, 10);

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

const urls = [...coreRoutes, ...townRoutes];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((route) => renderUrl(route, lastmod)).join('\n')}
</urlset>
`;

writeFileSync(join(distDir, 'sitemap.xml'), xml);
console.log(`Created sitemap.xml with ${urls.length.toLocaleString()} URLs.`);

function renderUrl(route, lastmod) {
  const loc = `${baseUrl}${route}`;
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </url>`;
}

function firstExisting(paths) {
  const found = paths.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`No file found. Checked: ${paths.join(', ')}`);
  }
  return found;
}

function normaliseBaseUrl(value) {
  return value.replace(/\/$/, '');
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
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
