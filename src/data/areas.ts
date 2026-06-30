import type { HerdArea } from '../types';
import generatedAreas from './generated/areas.json';

// Generated from data/generated/areas.json.
// Run `npm run data:cover:all` after refreshing official COVER source files.
export const areas = generatedAreas as HerdArea[];

export const deployedNationalStats = {
  sourceLabel: 'UKHSA COVER Q4 2025–26 GP data · England',
  englandAverage: 88.9,
  herdImmunityTarget: 95,
  unvaccinatedChildren: 14295,
  totalAreasTracked: 1132,
  atRiskAreas: 461,
  vulnerableAreas: 441,
  protectedAreas: 230
};
