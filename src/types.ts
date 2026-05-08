export type RiskStatus = 'AT_RISK' | 'VULNERABLE' | 'PROTECTED';

export interface HerdArea {
  postcodeDistrict: string;
  region: string;
  practiceCount: number;
  coverage: number;
  totalEligible: number;
  totalVaccinated: number;
  status: RiskStatus;
}

export interface TrendPoint {
  year: string;
  englandMmr1: number;
  englandMmr2: number;
  selectedArea?: number;
  target: number;
}
