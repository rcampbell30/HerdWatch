import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const brandName = 'Immunity Map';
const brandTagline = 'Local MMR coverage and herd-immunity gaps across England.';
const distDir = 'dist';
const sourceIndex = join(distDir, 'index.html');
const baseUrl = normaliseBaseUrl(process.env.SITE_URL || process.env.URL || 'https://immunitymap.netlify.app');

const routes = [
  'towns',
  'methodology',
  'map',
  'myths',
  'wakefield'
];

if (!existsSync(sourceIndex)) {
  throw new Error('dist/index.html does not exist. Run vite build before creating route entrypoints.');
}

for (const route of routes) {
  const target = join(distDir, route, 'index.html');

  // Important: Vite copies static files from public/ into dist/ first.
  // If public/myths/index.html or public/wakefield/index.html already exists,
  // do not overwrite it with the generic React SPA index.html.
  // This preserves the original long-form static pages.
  if (existsSync(target)) {
    console.log(`Preserved existing ${target}`);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(sourceIndex, target);
  console.log(`Created ${target}`);
}

const areasPath = firstExisting([
  join(distDir, 'data', 'areas.json'),
  join('public', 'data', 'areas.json')
]);
const areas = JSON.parse(readFileSync(areasPath, 'utf8'));
const sourceHtml = readFileSync(sourceIndex, 'utf8');

for (const area of areas) {
  const slug = area.postcodeDistrict.toLowerCase();
  const target = join(distDir, 'town', slug, 'index.html');
  const html = withTownSeo(sourceHtml, area, slug);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`Created SEO town entrypoint ${target}`);
}

function withTownSeo(html, area, slug) {
  const title = `${area.postcodeDistrict} MMR Vaccination Coverage | ${brandName}`;
  const description = `Track ${area.postcodeDistrict} MMR vaccination coverage, herd-immunity gap, risk status and estimated unvaccinated children using generated NHS COVER data.`;
  const canonical = `${baseUrl}/town/${slug}/`;
  const unvaccinated = Math.max(0, area.totalEligible - area.totalVaccinated);
  const gap = Math.max(0, 95 - area.coverage).toFixed(1);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: brandName,
      description: brandTagline,
      url: baseUrl
    },
    about: {
      '@type': 'Dataset',
      name: `${area.postcodeDistrict} MMR vaccination coverage`,
      spatialCoverage: area.postcodeDistrict,
      variableMeasured: [
        'MMR1 vaccination coverage',
        'Herd-immunity gap',
        'Eligible children',
        'Vaccinated children',
        'Estimated unvaccinated children'
      ]
    }
  };

  let updated = html;
  updated = replaceTitle(updated, title);
  updated = setMetaName(updated, 'description', description);
  updated = setMetaName(updated, 'robots', 'index, follow');
  updated = setMetaProperty(updated, 'og:title', title);
  updated = setMetaProperty(updated, 'og:description', description);
  updated = setMetaProperty(updated, 'og:url', canonical);
  updated = setMetaName(updated, 'twitter:title', title);
  updated = setMetaName(updated, 'twitter:description', description);
  updated = setCanonical(updated, canonical);
  updated = injectJsonLd(updated, jsonLd);
  updated = injectNoscriptSummary(updated, area, unvaccinated, gap);
  return updated;
}

function injectNoscriptSummary(html, area, unvaccinated, gap) {
  const summary = `<noscript><main><h1>${escapeHtml(area.postcodeDistrict)} MMR vaccination coverage</h1><p>${escapeHtml(area.postcodeDistrict)} is listed in ${escapeHtml(area.region)} with ${escapeHtml(String(area.coverage))}% MMR1 coverage. The local gap to the 95% herd-immunity target is ${escapeHtml(gap)} percentage points. The generated data represents ${escapeHtml(String(area.practiceCount))} practices, ${escapeHtml(String(area.totalEligible))} eligible children, ${escapeHtml(String(area.totalVaccinated))} vaccinated children and an estimated ${escapeHtml(String(unvaccinated))} children not counted as vaccinated. ${brandName} is an explanatory public-health data interface, not medical advice.</p></main></noscript>`;
  return html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${summary}`);
}

function replaceTitle(html, title) {
  return html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function setMetaName(html, name, content) {
  const tag = `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}" />`;
  const pattern = new RegExp(`<meta\\s+name=["']${escapeRegExp(name)}["'][^>]*>`, 'i');
  return replaceOrInsertBeforeHeadClose(html, pattern, tag);
}

function setMetaProperty(html, property, content) {
  const tag = `<meta property="${escapeAttr(property)}" content="${escapeAttr(content)}" />`;
  const pattern = new RegExp(`<meta\\s+property=["']${escapeRegExp(property)}["'][^>]*>`, 'i');
  return replaceOrInsertBeforeHeadClose(html, pattern, tag);
}

function setCanonical(html, href) {
  const tag = `<link rel="canonical" href="${escapeAttr(href)}" />`;
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  return replaceOrInsertBeforeHeadClose(html, pattern, tag);
}

function injectJsonLd(html, value) {
  const tag = `<script type="application/ld+json">${escapeScriptJson(JSON.stringify(value))}</script>`;
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceOrInsertBeforeHeadClose(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeScriptJson(value) {
  return value.replace(/</g, '\\u003c');
}
