import type { HerdArea } from '../types';
import generatedAreas from './generated/areas.json';
import metadata from './generated/metadata.json';

// Generated from data/generated/areas.json.
// Run `npm run data:cover:all` after refreshing official COVER source files.
export const areas = generatedAreas as HerdArea[];

export const deployedNationalStats = {
  sourceLabel: `UKHSA COVER GP data · ${metadata.reportingPeriod ?? 'Reporting period not recorded'} · England`,
  englandAverage: 87.3,
  herdImmunityTarget: 95,
  unvaccinatedChildren: 14295,
  totalAreasTracked: 1132,
  atRiskAreas: 461,
  vulnerableAreas: 441,
  protectedAreas: 230
};
