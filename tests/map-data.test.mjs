import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectMapCentroids } from '../scripts/lib/map-data.mjs';

const point = (count) => ({ latitude: 54.2, longitude: -3.2, postcodeUnitCount: count });
const reference = {
  metadata: { source: 'ONS Postcode Directory (May 2026)', areaCount: 3, postcodeUnitCount: 60 },
  centroids: { FY1: point(10), LA16: point(20), OLD: point(30) }
};

test('the committed ONS reference includes the LA16 point required by refreshed COVER data', () => {
  const actual = JSON.parse(readFileSync('data/reference/map-centroids.json', 'utf8'));
  const result = selectMapCentroids([{ postcodeDistrict: 'LA16' }], actual);
  assert.ok(Number.isFinite(result.centroids.LA16.latitude));
  assert.ok(Number.isFinite(result.centroids.LA16.longitude));
  assert.ok(result.centroids.LA16.postcodeUnitCount > 0);
  assert.equal(actual.metadata.areaCount, Object.keys(actual.centroids).length);
});

test('a refreshed district such as LA16 gets its verified reference point', () => {
  const result = selectMapCentroids([{ postcodeDistrict: 'LA16' }, { postcodeDistrict: 'FY1' }], reference);
  assert.deepEqual(Object.keys(result.centroids), ['FY1', 'LA16']);
  assert.deepEqual(result.centroids.LA16, reference.centroids.LA16);
  assert.equal(result.metadata.areaCount, 2);
  assert.equal(result.metadata.postcodeUnitCount, 30);
  assert.equal(result.metadata.source, reference.metadata.source);
  assert.equal(reference.metadata.areaCount, 3);
});

test('departed districts are removed from the display without altering the reference pool', () => {
  const result = selectMapCentroids([{ postcodeDistrict: 'FY1' }], reference);
  assert.deepEqual(Object.keys(result.centroids), ['FY1']);
  assert.equal(result.metadata.postcodeUnitCount, 10);
  assert.ok(reference.centroids.LA16);
});

test('missing geography, empty data and duplicate districts remain hard failures', () => {
  assert.throws(() => selectMapCentroids([{ postcodeDistrict: 'UNKNOWN' }], reference), /Refresh map geography/);
  assert.throws(() => selectMapCentroids([], reference), /empty/);
  assert.throws(() => selectMapCentroids([{ postcodeDistrict: 'FY1' }, { postcodeDistrict: 'FY1' }], reference), /Duplicate/);
});
