import { createHash } from 'node:crypto';

export function sourceMetadata(csv, provenance) {
  const matches = provenance?.areasSha256 === createHash('sha256').update(csv).digest('hex');
  return {
    reportingPeriod: matches ? provenance.reportingPeriod ?? null : null,
    lastSuccessfulImportAt: matches ? provenance.lastSuccessfulImportAt ?? null : null,
    sourceFile: matches ? provenance.sourceFile ?? null : null,
    provenanceVerified: matches,
    countsNote: 'Vaccinated counts may be reconstructed from rounded source percentages. Vaccinated, not-recorded-vaccinated and gap-to-target counts should be treated as approximate.'
  };
}
