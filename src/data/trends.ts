import type { TrendPoint } from '../types';
import generatedTrend from './generated/trends.json';

// Generated from data/raw/trends.csv by `npm run data:build`.
// The public chart uses like-for-like England Q4 headline points from UKHSA.
export const nationalTrend = generatedTrend as TrendPoint[];

export function buildAreaTrend(currentCoverage: number): TrendPoint[] {
  return nationalTrend.map((point, index) => ({
    ...point,
    selectedArea: index === nationalTrend.length - 1 ? Number(currentCoverage.toFixed(1)) : undefined
  }));
}
