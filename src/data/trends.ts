import type { TrendPoint } from '../types';
import generatedTrend from './generated/trends.json';

// Generated from data/generated/trends.json.
// Replace scaffold values with real historic NHS COVER extracts via `npm run data:build`.
export const nationalTrend = generatedTrend as TrendPoint[];

export function buildAreaTrend(currentCoverage: number): TrendPoint[] {
  const latestEngland = nationalTrend[nationalTrend.length - 1]?.englandMmr1 ?? 88.9;
  const drift = currentCoverage - latestEngland;

  return nationalTrend.map((point, index) => {
    const normalisedIndex = index / Math.max(1, nationalTrend.length - 1);
    return {
      ...point,
      selectedArea: Number((point.englandMmr1 + drift * (0.35 + normalisedIndex * 0.65)).toFixed(1))
    };
  });
}
