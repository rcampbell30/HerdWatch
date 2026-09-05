import type { HerdArea } from './types';

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
