import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';

const replacements = [
  ['Herd<span>Watch</span>', 'Immunity<span>Map</span>'],
  ['Herd<span>Watch', 'Immunity<span>Map']
];

const targetExtensions = new Set(['.html', '.js', '.css', '.xml', '.txt']);

if (!existsAsDirectory(distDir)) {
  throw new Error('dist/ does not exist. Run vite build before applying public branding.');
}

const files = walkFiles(distDir).filter((file) => targetExtensions.has(getExtension(file)));
let changedCount = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated = original;

  for (const [from, to] of replacements) {
    updated = updated.split(from).join(to);
  }

  if (updated !== original) {
    writeFileSync(file, updated);
    changedCount += 1;
    console.log(`Applied public branding to ${file}`);
  }
}

console.log(`Public branding pass complete. Updated ${changedCount} files.`);

function walkFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    return stats.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

function getExtension(file) {
  const index = file.lastIndexOf('.');
  return index === -1 ? '' : file.slice(index);
}

function existsAsDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
