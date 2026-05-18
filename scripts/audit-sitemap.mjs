import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const sitemapPath = join(distDir, 'sitemap.xml');
const expectedBaseUrl = normaliseBaseUrl(process.env.SITE_URL || process.env.URL || 'https://immunitymap.netlify.app');
const expectedOrigin = new URL(expectedBaseUrl).origin;
const maxUrls = Number.parseInt(process.env.MAX_SITEMAP_URLS || '2500', 10);

const coreRoutes = new Set([
  '/',
  '/towns/',
  '/map/',
  '/myths/',
  '/wakefield/',
  '/methodology/'
]);

const forbiddenRoutePatterns = [
  { name: 'topic/tag route flood', pattern: /^\/(topics|tags)\// },
  { name: 'search route', pattern: /^\/search(\/|$)/ },
  { name: 'filter route', pattern: /^\/filter(\/|$)/ },
  { name: 'legacy hash route marker', pattern: /#|%23/ },
  { name: 'legacy query route marker', pattern: /\?|%3F/i }
];

const legacyHosts = [
  'herdwatchuk.netlify.app',
  'www.herdwatchuk.netlify.app'
];

const errors = [];
const warnings = [];

if (!existsSync(distDir)) {
  fail('dist/ does not exist. Run npm run build before npm run seo:audit.');
}

if (!existsSync(sitemapPath)) {
  fail('dist/sitemap.xml does not exist. The sitemap generator did not create a sitemap.');
}

const sitemapXml = readFileSync(sitemapPath, 'utf8');
const urls = extractLocs(sitemapXml);

if (urls.length === 0) {
  fail('No <loc> URLs found in dist/sitemap.xml.');
}

if (urls.length > maxUrls) {
  fail(`Sitemap contains ${urls.length.toLocaleString()} URLs, above MAX_SITEMAP_URLS=${maxUrls.toLocaleString()}. If this is intentional, raise MAX_SITEMAP_URLS explicitly.`);
}

const seen = new Set();

for (const loc of urls) {
  if (seen.has(loc)) {
    errors.push(`Duplicate sitemap URL: ${loc}`);
    continue;
  }
  seen.add(loc);

  let parsed;
  try {
    parsed = new URL(loc);
  } catch {
    errors.push(`Invalid URL in sitemap: ${loc}`);
    continue;
  }

  if (legacyHosts.includes(parsed.host)) {
    errors.push(`Legacy HerdWatch host leaked into sitemap: ${loc}`);
  }

  if (parsed.origin !== expectedOrigin) {
    errors.push(`Unexpected sitemap origin: ${loc}. Expected origin ${expectedOrigin}.`);
  }

  if (parsed.protocol !== 'https:') {
    errors.push(`Sitemap URL is not HTTPS: ${loc}`);
  }

  if (parsed.search) {
    errors.push(`Sitemap URL contains a query string: ${loc}`);
  }

  if (parsed.hash) {
    errors.push(`Sitemap URL contains a hash fragment: ${loc}`);
  }

  const route = parsed.pathname;

  for (const { name, pattern } of forbiddenRoutePatterns) {
    if (pattern.test(route) || pattern.test(loc)) {
      errors.push(`Forbidden ${name} in sitemap URL: ${loc}`);
    }
  }

  if (!isAllowedRoute(route)) {
    errors.push(`Unexpected route pattern in sitemap: ${loc}. Expected core routes or /town/{postcode-district}/.`);
  }

  const htmlPath = htmlPathForRoute(route);
  if (!existsSync(htmlPath)) {
    errors.push(`Sitemap URL has no matching generated HTML file: ${loc} -> ${htmlPath}`);
    continue;
  }

  const html = readFileSync(htmlPath, 'utf8');
  const title = getTitle(html);
  const description = getMetaContent(html, 'description');
  const canonical = getCanonicalHref(html);

  if (!title) {
    warnings.push(`Missing <title> for ${loc}`);
  }

  if (!description) {
    warnings.push(`Missing meta description for ${loc}`);
  }

  if (canonical && canonical !== loc) {
    errors.push(`Canonical mismatch for ${loc}: found ${canonical}`);
  }

  if (!canonical && route.startsWith('/town/')) {
    errors.push(`Generated town page is missing self-canonical: ${loc}`);
  }
}

if (warnings.length > 0) {
  console.warn('\nSEO sitemap audit warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error('\nSEO sitemap audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO sitemap audit passed: ${urls.length.toLocaleString()} URLs checked for ${expectedOrigin}.`);

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

function isAllowedRoute(route) {
  return coreRoutes.has(route) || /^\/town\/[a-z0-9]+\/$/i.test(route);
}

function htmlPathForRoute(route) {
  if (route === '/') return join(distDir, 'index.html');
  return join(distDir, ...route.split('/').filter(Boolean), 'index.html');
}

function getTitle(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
}

function getMetaContent(html, name) {
  const escaped = escapeRegExp(name);
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const reversePattern = new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*name=["']${escaped}["'][^>]*>`, 'i');
  return html.match(pattern)?.[1]?.trim() || html.match(reversePattern)?.[1]?.trim() || '';
}

function getCanonicalHref(html) {
  const tag = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || '';
  return tag.match(/href=["']([^"']+)["']/i)?.[1]?.trim() || '';
}

function normaliseBaseUrl(value) {
  return String(value).replace(/\/$/, '');
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  console.error(`SEO sitemap audit failed: ${message}`);
  process.exit(1);
}
