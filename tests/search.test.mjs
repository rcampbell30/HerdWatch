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
const { searchAreas, postcodeDistrict } = await import(pathToFileURL(join(output, 'search.mjs')));
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
