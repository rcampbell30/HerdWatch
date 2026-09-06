import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compile with the project's TypeScript version; tests also work on Node 20.
const output = mkdtempSync(join(tmpdir(), 'immunity-search-'));
execFileSync(resolve('node_modules/.bin/tsc'), ['--ignoreConfig', 'src/search.ts', '--outDir', output, '--module', 'ESNext', '--target', 'ES2020', '--skipLibCheck']);
renameSync(join(output, 'search.js'), join(output, 'search.mjs'));
const { searchAreas, postcodeDistrict, readExplorerFilters, writeExplorerFilters } = await import(pathToFileURL(join(output, 'search.mjs')));
after(() => rmSync(output, { recursive: true, force: true }));
const areas = JSON.parse(readFileSync('src/data/generated/areas.json', 'utf8'));
const places = JSON.parse(readFileSync('src/data/generated/search-places.json', 'utf8'));

test('full postcodes with mixed case and spacing resolve to the exact outward district', () => {
  for (const query of [' fy1 1aa ', 'FY11AA', 'FY1', 'fy1\t1aa']) {
    assert.equal(postcodeDistrict(query), 'FY1');
    assert.deepEqual(searchAreas(areas, query, places).map(a => a.postcodeDistrict), ['FY1']);
  }
  assert.equal(postcodeDistrict('SW1A 1AA'), 'SW1A');
  assert.equal(postcodeDistrict('M7 3XX'), 'M7');
});

test('an unavailable postcode returns no unrelated or partial district match', () => {
  assert.deepEqual(searchAreas(areas, 'ZZ99 9ZZ', places), []);
  assert.deepEqual(searchAreas(areas, '!!!', places), []);
  assert.ok(searchAreas(areas, 'M1', places).every(a => a.postcodeDistrict === 'M1'));
});

test('place names preserve every matching district and NHS grouping search still works', () => {
  const matches = searchAreas(areas, 'Blackpool', places);
  assert.ok(matches.length > 1);
  assert.ok(matches.some(a => a.postcodeDistrict === 'FY1'));
  assert.ok(matches.every(a => places[a.postcodeDistrict].some(p => p.toLowerCase().includes('blackpool'))));
  assert.ok(searchAreas(areas, 'Greater Manchester', places).length > 0);
  assert.deepEqual(searchAreas(areas, 'Stockton-on-Tees', places), searchAreas(areas, 'Stockton on Tees', places));
  assert.equal(searchAreas(areas, '', places).length, areas.length);
});

test('shared Explorer URLs restore all filters and the same matching districts', () => {
  const regions = [...new Set(areas.map(a => a.region))];
  const filters = { query: 'Blackpool', status: 'AT_RISK', region: areas.find(a => a.postcodeDistrict === 'FY1').region };
  const saved = writeExplorerFilters('?utm_source=share', filters);
  const restored = readExplorerFilters(saved, regions);
  assert.deepEqual(restored, filters);
  assert.equal(new URLSearchParams(saved).get('utm_source'), 'share');
  const matches = searchAreas(areas, restored.query, places).filter(a => a.status === restored.status && a.region === restored.region);
  assert.deepEqual(matches.map(a => a.postcodeDistrict).sort(), ['FY1', 'FY4']);
});

test('invalid filters fall back safely and clearing removes only Explorer parameters', () => {
  assert.deepEqual(readExplorerFilters('?q=FY1&status=invalid&region=missing', []), { query: 'FY1', status: 'ALL', region: 'ALL' });
  const cleared = { query: '', status: 'ALL', region: 'ALL' };
  assert.equal(writeExplorerFilters('?q=FY1&status=AT_RISK&region=anything', cleared), '');
  assert.equal(writeExplorerFilters('?q=FY1&utm_source=share', cleared), '?utm_source=share');
  const filters = { query: 'Stockton-on-Tees & nearby', status: 'PROTECTED', region: 'Example & region' };
  assert.deepEqual(readExplorerFilters(writeExplorerFilters('', filters), [filters.region]), filters);
});
