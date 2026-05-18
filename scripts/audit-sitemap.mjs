import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const sitemapPath = join(distDir, 'sitemap.xml');
const expectedBaseUrl = normaliseBaseUrl(process.env.SITE_URL || 'https://immunitymap.netlify.app');
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

const validChangefreqs = new Set([
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never'
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

validateXmlShape(sitemapXml);

const entries = extractUrlEntries(sitemapXml);
const urls = entries.map((entry) => entry.loc).filter(Boolean);

if (entries.length === 0) {
  fail('No <url> entries found in dist/sitemap.xml.');
}

if (urls.length === 0) {
  fail('No <loc> URLs found in dist/sitemap.xml.');
}

if (urls.length !== entries.length) {
  errors.push(`Sitemap has ${entries.length} <url> entries but only ${urls.length} <loc> values.`);
}

if (urls.length > maxUrls) {
  fail(`Sitemap contains ${urls.length.toLocaleString()} URLs, above MAX_SITEMAP_URLS=${maxUrls.toLocaleString()}. If this is intentional, raise MAX_SITEMAP_URLS explicitly.`);
}

const seen = new Set();

for (const entry of entries) {
  const { loc, lastmod, changefreq, priority } = entry;

  if (!loc) {
    errors.push('A sitemap <url> entry is missing <loc>.');
    continue;
  }

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

  if (!lastmod) {
    errors.push(`Missing <lastmod> for ${loc}`);
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
    errors.push(`Invalid <lastmod> format for ${loc}: ${lastmod}. Expected YYYY-MM-DD.`);
  }

  if (!changefreq) {
    errors.push(`Missing <changefreq> for ${loc}`);
  } else if (!validChangefreqs.has(changefreq)) {
    errors.push(`Invalid <changefreq> for ${loc}: ${changefreq}`);
  }

  if (!priority) {
    errors.push(`Missing <priority> for ${loc}`);
  } else if (!isValidPriority(priority)) {
    errors.push(`Invalid <priority> for ${loc}: ${priority}. Expected a number from 0.0 to 1.0.`);
  }

  const route = parsed.pathname;
  const expectedChangefreq = expectedChangefreqForRoute(route);
  const expectedPriority = expectedPriorityForRoute(route);

  if (changefreq && expectedChangefreq && changefreq !== expectedChangefreq) {
    errors.push(`Unexpected <changefreq> for ${loc}: ${changefreq}. Expected ${expectedChangefreq}.`);
  }

  if (priority && expectedPriority && priority !== expectedPriority) {
    errors.push(`Unexpected <priority> for ${loc}: ${priority}. Expected ${expectedPriority}.`);
  }

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

function validateXmlShape(xml) {
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<?xml')) {
    errors.push('Sitemap is missing XML declaration.');
  }
  if (!trimmed.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    errors.push('Sitemap is missing the standard sitemap <urlset> opening tag.');
  }
  if (!trimmed.endsWith('</urlset>')) {
    errors.push('Sitemap is missing closing </urlset> tag.');
  }

  const openUrlCount = countMatches(xml, /<url>/g);
  const closeUrlCount = countMatches(xml, /<\/url>/g);
  if (openUrlCount !== closeUrlCount) {
    errors.push(`Sitemap has mismatched <url> tags: ${openUrlCount} opening, ${closeUrlCount} closing.`);
  }
}

function extractUrlEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => {
    const block = match[1];
    return {
      loc: getTagValue(block, 'loc'),
      lastmod: getTagValue(block, 'lastmod'),
      changefreq: getTagValue(block, 'changefreq'),
      priority: getTagValue(block, 'priority')
    };
  });
}

function getTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function isValidPriority(value) {
  if (!/^\d(?:\.\d)?$/.test(value)) return false;
  const number = Number(value);
  return number >= 0 && number <= 1;
}

function expectedChangefreqForRoute(route) {
  if (route === '/') return 'daily';
  if (route.startsWith('/town/')) return 'monthly';
  if (isTopLevelRoute(route)) return 'weekly';
  return 'monthly';
}

function expectedPriorityForRoute(route) {
  if (route === '/') return '1.0';
  if (route.startsWith('/town/')) return '0.6';
  if (isTopLevelRoute(route)) return '0.8';
  return '0.5';
}

function isTopLevelRoute(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length === 1;
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

function countMatches(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  console.error(`SEO sitemap audit failed: ${message}`);
  process.exit(1);
}
