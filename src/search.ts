import type { HerdArea, RiskStatus } from './types';

export type PlaceNames = Record<string, string[]>;
const textKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

export function postcodeDistrict(query: string): string | undefined {
  const compact = query.toUpperCase().replace(/\s+/g, '');
  const full = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)\d[A-Z]{2}$/);
  if (full) return full[1];
  if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact)) return compact;
  return undefined;
}

export function searchAreas(areas: HerdArea[], query: string, places: PlaceNames): HerdArea[] {
  const key = textKey(query);
  if (!key) return query.trim() ? [] : [...areas];
  const district = postcodeDistrict(query);
  // A recognised postcode shape must never fall back to an unrelated area.
  if (district) return areas.filter(area => area.postcodeDistrict === district);
  return areas.filter(area =>
    textKey(area.postcodeDistrict).startsWith(key) ||
    textKey(area.region).includes(key) ||
    (places[area.postcodeDistrict] ?? []).some(place => textKey(place).includes(key))
  );
}

export type ExplorerFilters = { query: string; status: RiskStatus | 'ALL'; region: string };

export function readExplorerFilters(search: string, regions: string[]): ExplorerFilters {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const region = params.get('region');
  return {
    query: params.get('q') ?? '',
    status: status === 'AT_RISK' || status === 'VULNERABLE' || status === 'PROTECTED' ? status : 'ALL',
    region: region && regions.includes(region) ? region : 'ALL'
  };
}

export function writeExplorerFilters(search: string, filters: ExplorerFilters): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of [['q', filters.query], ['status', filters.status], ['region', filters.region]]) {
    if (key === 'q' ? value.trim().length > 0 : value !== 'ALL') params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
