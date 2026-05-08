import type { TrendPoint } from '../types';

// Placeholder historic series for the rebuilt source project.
// Replace with real historic NHS COVER annual or quarterly extracts before presenting these as final data.
export const nationalTrend: TrendPoint[] = [
  { year: '2018–19', englandMmr1: 90.6, englandMmr2: 86.4, target: 95 },
  { year: '2019–20', englandMmr1: 90.2, englandMmr2: 86.6, target: 95 },
  { year: '2020–21', englandMmr1: 90.3, englandMmr2: 86.6, target: 95 },
  { year: '2021–22', englandMmr1: 89.2, englandMmr2: 85.7, target: 95 },
  { year: '2022–23', englandMmr1: 89.3, englandMmr2: 84.5, target: 95 },
  { year: '2023–24', englandMmr1: 88.9, englandMmr2: 84.3, target: 95 },
  { year: '2024–25 Q3', englandMmr1: 88.9, englandMmr2: 84.0, target: 95 }
];

export function buildAreaTrend(currentCoverage: number): TrendPoint[] {
  const drift = currentCoverage - 88.9;
  return nationalTrend.map((point, index) => {
    const normalisedIndex = index / Math.max(1, nationalTrend.length - 1);
    return {
      ...point,
      selectedArea: Number((point.englandMmr1 + drift * (0.35 + normalisedIndex * 0.65)).toFixed(1))
    };
  });
}
