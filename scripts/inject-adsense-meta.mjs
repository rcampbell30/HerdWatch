import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const adsenseMeta = '<meta name="google-adsense-account" content="ca-pub-4712774395612376" />';

function walkHtmlFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkHtmlFiles(fullPath));
    } else if (entry.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const htmlFiles = walkHtmlFiles(distDir);
let injectedCount = 0;
let existingCount = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');

  if (html.includes('google-adsense-account')) {
    existingCount += 1;
    continue;
  }

  const updated = html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, `$1\n${adsenseMeta}`);

  if (updated === html) {
    throw new Error(`Could not find viewport meta tag in ${file}`);
  }

  writeFileSync(file, updated);
  injectedCount += 1;
}

console.log(`AdSense metadata checked in ${htmlFiles.length.toLocaleString()} HTML files: ${injectedCount.toLocaleString()} injected, ${existingCount.toLocaleString()} already present.`);
