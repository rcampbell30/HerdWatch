import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const actions = [];
const warnings = [];

const ADS_TXT_CONTENT = 'google.com, pub-4712774395612376, DIRECT, f08c47fec0942fa0\n';
const ADSENSE_META = '<meta name="google-adsense-account" content="ca-pub-4712774395612376" />';

const CANONICAL_REDIRECTS = [
  '/methodologies  /methodology/   301',
  '/methodologies/ /methodology/   301',
  '/map            /map/           301',
  '/towns          /towns/         301',
  '/methodology    /methodology/   301',
  '/mythology      /methodology/   301',
  '/myths          /myths/         301',
  '/wakefield      /wakefield/     301',
  '/map/           /map/index.html           200',
  '/towns/         /towns/index.html         200',
  '/methodology/   /methodology/index.html   200',
  '/myths/         /myths/index.html         200',
  '/wakefield/     /wakefield/index.html     200',
  '/town/*         /index.html               200'
];

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.netlify',
  '.vite',
  'coverage'
]);

function rel(path) {
  return relative(root, path).replaceAll('\\\\', '/');
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function writeIfChanged(path, content, message) {
  const current = existsSync(path) ? read(path) : null;
  if (current === content) return false;
  ensureDir(dirname(path));
  writeFileSync(path, content);
  actions.push(message ?? `Updated ${rel(path)}`);
  return true;
}

function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];

  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;

    const full = join(dir, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      files.push(...walkFiles(full));
    } else {
      files.push(full);
    }
  }

  return files;
}

function ensurePublicAdsTxt() {
  const publicAds = join(root, 'public', 'ads.txt');
  writeIfChanged(publicAds, ADS_TXT_CONTENT, 'Ensured public/ads.txt has the correct Google AdSense publisher line');

  const adsFiles = walkFiles(root).filter((file) => rel(file).endsWith('ads.txt'));

  for (const file of adsFiles) {
    const path = rel(file);
    if (path === 'public/ads.txt') continue;

    const content = read(file).trim();
    const isDuplicate = content === ADS_TXT_CONTENT.trim() || content.includes('pub-4712774395612376');

    if (isDuplicate) {
      rmSync(file);
      actions.push(`Removed duplicate/misplaced ${path}; canonical ads.txt belongs at public/ads.txt`);
    } else {
      warnings.push(`Found non-standard ads.txt at ${path}; left it alone for manual review`);
    }
  }
}

function ensureRedirects() {
  const redirectsPath = join(root, 'public', '_redirects');
  const currentLines = existsSync(redirectsPath)
    ? read(redirectsPath).split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean)
    : [];

  const canonicalStarts = new Set(CANONICAL_REDIRECTS.map((line) => line.split(/\s+/)[0]));
  const extras = currentLines.filter((line) => {
    const start = line.trim().split(/\s+/)[0];
    return !canonicalStarts.has(start);
  });

  const next = [...CANONICAL_REDIRECTS, ...extras].join('\n') + '\n';
  writeIfChanged(redirectsPath, next, 'Normalised public/_redirects, including /town/* -> /index.html for React town routes');
}

function ensureAdsenseMetaInHtmlSources() {
  const htmlFiles = [join(root, 'index.html'), ...walkFiles(join(root, 'public')).filter((file) => file.endsWith('.html'))];

  for (const file of htmlFiles) {
    if (!existsSync(file)) continue;

    const html = read(file);
    if (html.includes('google-adsense-account')) continue;

    const updated = html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n${ADSENSE_META}`);

    if (updated === html) {
      warnings.push(`Could not inject AdSense meta into ${rel(file)} because no viewport meta tag was found`);
      continue;
    }

    writeIfChanged(file, updated, `Injected AdSense meta tag into ${rel(file)}`);
  }
}

function moveKnownStandaloneHtmlFiles() {
  const movableRoutes = new Set(['myths', 'wakefield', 'map', 'towns', 'methodology']);

  for (const file of walkFiles(root)) {
    const path = rel(file);
    if (!path.endsWith('.html')) continue;
    if (path.includes('/')) continue;
    if (path === 'index.html') continue;

    const routeName = path.replace(/\.html$/i, '').toLowerCase();
    if (!movableRoutes.has(routeName)) {
      warnings.push(`Found root-level HTML file ${path}; left it alone because route is unknown`);
      continue;
    }

    const target = join(root, 'public', routeName, 'index.html');
    if (existsSync(target)) {
      warnings.push(`Found ${path}, but ${rel(target)} already exists. Left both alone for manual review`);
      continue;
    }

    const content = read(file);
    writeIfChanged(target, content, `Moved ${path} into public/${routeName}/index.html`);
    rmSync(file);
    actions.push(`Removed old root-level ${path}`);
  }
}

function checkExpectedStaticPages() {
  const expected = [
    'public/myths/index.html',
    'public/wakefield/index.html',
    'public/map/index.html'
  ];

  for (const path of expected) {
    if (!existsSync(join(root, path))) {
      warnings.push(`Expected static page missing: ${path}`);
    }
  }
}

function main() {
  ensurePublicAdsTxt();
  ensureRedirects();
  ensureAdsenseMetaInHtmlSources();
  moveKnownStandaloneHtmlFiles();
  checkExpectedStaticPages();

  if (actions.length === 0 && warnings.length === 0) {
    console.log('Repo hygiene: clean. No changes needed.');
    return;
  }

  if (actions.length > 0) {
    console.log('\nRepo hygiene actions:');
    for (const action of actions) console.log(`- ${action}`);
  }

  if (warnings.length > 0) {
    console.log('\nRepo hygiene warnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }
}

main();
