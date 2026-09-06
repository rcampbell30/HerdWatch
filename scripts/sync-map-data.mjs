import { readFileSync, writeFileSync } from 'node:fs';
import { selectMapCentroids } from './lib/map-data.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const result = selectMapCentroids(read('public/data/areas.json'), read('data/reference/map-centroids.json'));
// Resolve every district before writing. The existing map validator still checks
// coordinates, metadata totals and exact membership before Vite can build.
writeFileSync('public/data/map-centroids.json', JSON.stringify(result, null, 2) + '\n');
console.log(`Selected ONS reference centroids for ${result.metadata.areaCount} coverage districts.`);
