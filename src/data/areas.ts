import type { HerdArea } from '../types';
import generatedAreas from './generated/areas.json';

// Generated from data/generated/areas.json.
// Run `npm run data:build` after changing files under data/raw/.
export const areas = generatedAreas as HerdArea[];

export const deployedNationalStats = {
  sourceLabel: 'NHS COVER Q3 2024–25 · England',
  englandAverage: 88.9,
  herdImmunityTarget: 95,
  unvaccinatedChildren: 14295,
  totalAreasTracked: 1132,
  atRiskAreas: 461,
  vulnerableAreas: 441,
  protectedAreas: 230
};
