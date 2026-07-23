import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const brandName = 'Immunity Map';
const brandTagline = 'Recorded MMR coverage grouped by GP-practice postcode district across England.';
const distDir = 'dist';
const sourceIndex = join(distDir, 'index.html');
const baseUrl = normaliseBaseUrl(process.env.SITE_URL || process.env.URL || 'https://immunitymap.org');
const socialImage = `${baseUrl}/og-immunity-map.png`;

const routes = [
  { slug: 'towns', title: `All GP-Practice Postcode Areas | ${brandName}`, description: 'Search recorded MMR1 coverage grouped by GP-practice postcode district across England.' },
  { slug: 'methodology', title: `Data Sources and Methodology | ${brandName}`, description: 'How Immunity Map processes UKHSA COVER GP-practice data, calculates weighted coverage and handles geography and small samples.' },
  { slug: 'map', title: `MMR Coverage Explorer | ${brandName}`, description: 'Search UKHSA COVER records grouped by GP-practice postcode district, NHS region and recorded MMR1 coverage band.' },
  { slug: 'myths', title: `MMR, Autism and Vaccine Safety | ${brandName}`, description: 'A calm, sourced explanation of the evidence on MMR and autism and the known side effects of the vaccine.' },
  { slug: 'wakefield', title: `Andrew Wakefield: What the Evidence Shows | ${brandName}`, description: 'Who Andrew Wakefield was, how his 1998 Lancet paper and public statements made him central to the MMR scare, and what later investigations established.' }
];

if (!existsSync(sourceIndex)) {
  throw new Error('dist/index.html does not exist. Run vite build before creating route entrypoints.');
}

for (const route of routes) {
  const target = join(distDir, route.slug, 'index.html');
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : readFileSync(sourceIndex, 'utf8');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, withRouteSeo(existing, route));
  console.log(`Created SEO entrypoint ${target}`);
}

const areasPath = firstExisting([
  join(distDir, 'data', 'areas.json'),
  join('public', 'data', 'areas.json')
]);
const areas = JSON.parse(readFileSync(areasPath, 'utf8'));
const sourceHtml = readFileSync(sourceIndex, 'utf8');
let townPageCount = 0;

for (const area of areas) {
  const slug = area.postcodeDistrict.toLowerCase();
  const target = join(distDir, 'town', slug, 'index.html');
  const html = withTownSeo(sourceHtml, area, slug);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  townPageCount += 1;
}

console.log(`Created ${townPageCount.toLocaleString()} SEO town entrypoints.`);

function withTownSeo(html, area, slug) {
  const title = `${area.postcodeDistrict} GP-Practice MMR Coverage | ${brandName}`;
  const description = `Recorded MMR1 coverage for GP practices located in ${area.postcodeDistrict}. Practice-location indicator; not a resident-population estimate.`;
  const canonical = `${baseUrl}/town/${slug}/`;
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
      name: `${area.postcodeDistrict} GP-practice MMR vaccination coverage`,
      description: `Aggregated UKHSA COVER records for GP practices located in ${area.postcodeDistrict}, including recorded MMR1 coverage at 24 months, eligible records, vaccinated records and represented practices. This is a practice-location indicator, not a resident-population estimate.`,
      url: canonical,
      creator: {
        '@type': 'Person',
        name: 'Rory Campbell',
        url: `${baseUrl}/methodology/`
      },
      license: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
      isAccessibleForFree: true,
      isBasedOn: 'https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-2025-to-2026-quarterly-data',
      spatialCoverage: {
        '@type': 'Place',
        identifier: area.postcodeDistrict,
        description: 'Postcode district of the represented GP practices; not patient home address'
      },
      variableMeasured: [
        'Recorded MMR1 vaccination coverage at 24 months',
        'Eligible records',
        'Records counted as vaccinated',
        'Number of represented GP practices'
      ],
      measurementTechnique: 'Eligible-child-weighted aggregation by GP-practice outward postcode district'
    }
  };

  let updated = html;
  updated = replaceTitle(updated, title);
  updated = setMetaName(updated, 'description', description);
  updated = setMetaName(updated, 'robots', 'index, follow');
  updated = setMetaProperty(updated, 'og:title', title);
  updated = setMetaProperty(updated, 'og:description', description);
  updated = setMetaProperty(updated, 'og:url', canonical);
  updated = setMetaProperty(updated, 'og:image', socialImage);
  updated = setMetaName(updated, 'twitter:title', title);
  updated = setMetaName(updated, 'twitter:description', description);
  updated = setMetaName(updated, 'twitter:card', 'summary_large_image');
  updated = setMetaName(updated, 'twitter:image', socialImage);
  updated = setCanonical(updated, canonical);
  updated = injectJsonLd(updated, jsonLd);
  updated = injectNoscriptSummary(updated, area);
  return updated;
}

function injectNoscriptSummary(html, area) {
  const smallSample = area.totalEligible < 30 ? ' This is a small sample and the percentage may change sharply with a few records.' : '';
  const practiceWord = area.practiceCount === 1 ? 'practice' : 'practices';
  const summary = `<noscript><main><h1>${escapeHtml(area.postcodeDistrict)} GP-practice MMR coverage</h1><p>GP practices located in ${escapeHtml(area.postcodeDistrict)} are grouped with ${escapeHtml(String(area.coverage))}% recorded MMR1 coverage at 24 months. The data represents ${escapeHtml(String(area.practiceCount))} ${practiceWord}, ${escapeHtml(String(area.totalEligible))} eligible records and ${escapeHtml(String(area.totalVaccinated))} records counted as vaccinated.${escapeHtml(smallSample)} The postcode is the practice location, not each child's home; patients may live outside the district. This is a provisional practice-location indicator, not a resident-population estimate or medical advice.</p></main></noscript>`;
  return html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${summary}`);
}

function withRouteSeo(html, route) {
  const canonical = `${baseUrl}/${route.slug}/`;
  let updated = html;
  updated = replaceTitle(updated, route.title);
  updated = setMetaName(updated, 'description', route.description);
  updated = setMetaName(updated, 'robots', 'index, follow');
  updated = setMetaProperty(updated, 'og:title', route.title);
  updated = setMetaProperty(updated, 'og:description', route.description);
  updated = setMetaProperty(updated, 'og:type', route.slug === 'myths' || route.slug === 'wakefield' ? 'article' : 'website');
  updated = setMetaProperty(updated, 'og:url', canonical);
  updated = setMetaProperty(updated, 'og:image', socialImage);
  updated = setMetaName(updated, 'twitter:card', 'summary_large_image');
  updated = setMetaName(updated, 'twitter:title', route.title);
  updated = setMetaName(updated, 'twitter:description', route.description);
  updated = setMetaName(updated, 'twitter:image', socialImage);
  updated = setCanonical(updated, canonical);
  return updated;
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
