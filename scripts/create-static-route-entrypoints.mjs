import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const distDir = 'dist';
const sourceIndex = join(distDir, 'index.html');

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
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(sourceIndex, target);
  console.log(`Created ${target}`);
}
