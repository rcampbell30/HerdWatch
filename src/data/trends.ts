import type { TrendPoint } from '../types';
import generatedTrend from './generated/trends.json';

// Generated from data/raw/trends.csv by `npm run data:build`.
// At present this may contain a single annual COVER point if only one source year has been normalised.
export const nationalTrend = generatedTrend as TrendPoint[];

export function buildAreaTrend(currentCoverage: number): TrendPoint[] {
  return nationalTrend.map((point, index) => ({
    ...point,
    selectedArea: index === nationalTrend.length - 1 ? Number(currentCoverage.toFixed(1)) : undefined
  }));
}
