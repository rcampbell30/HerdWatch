import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceMetadata } from '../scripts/lib/source-metadata.mjs';

const csv = Buffer.from('postcode_district,total_eligible\nFY1,40\n');
const provenance = {
  areasSha256: createHash('sha256').update(csv).digest('hex'),
  reportingPeriod: 'January to March 2026',
  lastSuccessfulImportAt: '2026-07-20T12:00:00Z',
  sourceFile: 'cover-GP-Q4_2025-to-2026.ods'
};

test('rebuilding unchanged data preserves the actual import timestamp', () => {
  const result = sourceMetadata(csv, provenance);
  assert.equal(result.lastSuccessfulImportAt, provenance.lastSuccessfulImportAt);
  assert.equal(result.reportingPeriod, provenance.reportingPeriod);
  assert.equal(result.provenanceVerified, true);
});

test('replaced or example CSV cannot inherit another dataset’s dates', () => {
  const result = sourceMetadata(Buffer.from('different data'), provenance);
  assert.equal(result.lastSuccessfulImportAt, null);
  assert.equal(result.reportingPeriod, null);
  assert.equal(result.provenanceVerified, false);
});

test('unknown historical import dates stay unknown', () => {
  assert.equal(sourceMetadata(csv, { ...provenance, lastSuccessfulImportAt: null }).lastSuccessfulImportAt, null);
  assert.equal(sourceMetadata(csv, null).lastSuccessfulImportAt, null);
});
