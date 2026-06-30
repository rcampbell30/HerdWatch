import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';

const replacements = [
  ['Herd<span>Watch</span>', 'Immunity<span>Map</span>'],
  ['Herd<span>Watch', 'Immunity<span>Map'],
  ['HerdWatch — MMR Vaccination Coverage Tracker', 'Immunity Map — MMR Vaccination Coverage Tracker'],
  ['The Autism Myth — HerdWatch', 'The Autism Myth — Immunity Map'],
  ['Andrew Wakefield — The Man Who Started the Myth — HerdWatch', 'Andrew Wakefield — The Man Who Started the Myth — Immunity Map'],
  ['Back to HerdWatch', 'Back to Immunity Map'],
  ['How {brandName} handles the data', 'How Immunity Map handles the data'],
  ['HerdWatch tracks MMR vaccination coverage, local outbreak vulnerability and herd-immunity gaps across England.', 'Immunity Map shows local MMR coverage and herd-immunity gaps across England.'],
  ['HerdWatch is an explanatory public-health data interface', 'Immunity Map is an explanatory public-health data interface'],
  ['HerdWatch is a public-interest dashboard', 'Immunity Map is a public-interest dashboard'],
  ['HerdWatch currently marks this postcode district', 'Immunity Map currently marks this postcode district'],
  ['HerdWatch focuses on postcode-district level signals', 'Immunity Map focuses on postcode-district level signals'],
  ['HerdWatch uses generated NHS COVER area data', 'Immunity Map uses generated NHS COVER area data'],
  ['HerdWatch does not treat that story as gossip. It treats it as infrastructure damage', 'Immunity Map treats that story as infrastructure damage'],
  ['HerdWatch treats that story as infrastructure damage', 'Immunity Map treats that story as infrastructure damage'],
  ['That is why HerdWatch tracks postcode-district coverage', 'That is why Immunity Map tracks postcode-district coverage'],
  ['HerdWatch names him because he should be named.', 'Immunity Map names him because he should be named.'],
  ['Annual COVER series', 'COVER series + latest quarterly snapshot'],
  ['Latest annual COVER point', 'Latest COVER point'],
  ['generated annual series', 'generated COVER series'],
  ['one annual COVER point', 'one COVER point'],
  ['Generated annual COVER point for', 'Generated COVER point for'],
  ['England MMR1', 'England MMR1 (24m)'],
  ['England MMR2', 'England MMR2 (5y)'],
  ['HerdWatch', 'Immunity Map']
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
