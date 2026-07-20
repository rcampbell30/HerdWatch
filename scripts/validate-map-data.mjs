import fs from 'node:fs';

const areas = readJson('public/data/areas.json');
const centroidData = readJson('public/data/map-centroids.json');
const outline = readJson('public/data/england-outline.geojson');

assert(Array.isArray(areas) && areas.length > 0, 'Coverage area data is empty');
assert(centroidData?.centroids && typeof centroidData.centroids === 'object', 'Map centroids are missing');

const areaDistricts = new Set(areas.map((area) => area.postcodeDistrict));
const centroidDistricts = new Set(Object.keys(centroidData.centroids));
const missing = [...areaDistricts].filter((district) => !centroidDistricts.has(district));
const extra = [...centroidDistricts].filter((district) => !areaDistricts.has(district));

assert(areaDistricts.size === areas.length, 'Coverage area data contains duplicate postcode districts');
assert(missing.length === 0, `Map centroids are missing ${missing.length} districts: ${missing.slice(0, 20).join(', ')}`);
assert(extra.length === 0, `Map centroids contain ${extra.length} districts not present in coverage data: ${extra.slice(0, 20).join(', ')}`);
assert(centroidData.metadata?.areaCount === areas.length, 'Map metadata areaCount does not match coverage data');

let postcodeUnitCount = 0;
for (const [district, point] of Object.entries(centroidData.centroids)) {
  assert(Number.isFinite(point.longitude), `${district} has an invalid longitude`);
  assert(Number.isFinite(point.latitude), `${district} has an invalid latitude`);
  assert(point.longitude >= -7.5 && point.longitude <= 2.5, `${district} longitude is outside England map bounds`);
  assert(point.latitude >= 49 && point.latitude <= 56.5, `${district} latitude is outside England map bounds`);
  assert(Number.isInteger(point.postcodeUnitCount) && point.postcodeUnitCount > 0, `${district} has an invalid postcode unit count`);
  postcodeUnitCount += point.postcodeUnitCount;
}

assert(postcodeUnitCount === centroidData.metadata?.postcodeUnitCount, 'Map metadata postcodeUnitCount does not match centroid records');
assert(centroidData.metadata?.source?.includes('ONS Postcode Directory'), 'Map centroid source metadata is missing');
assert(Array.isArray(centroidData.metadata?.attribution) && centroidData.metadata.attribution.length === 3, 'Required ONSPD attribution statements are missing');

assert(outline?.type === 'FeatureCollection', 'England outline is not a GeoJSON FeatureCollection');
assert(Array.isArray(outline.features) && outline.features.length === 1, 'England outline must contain exactly one feature');
assert(outline.features[0]?.properties?.CTRY25CD === 'E92000001', 'England outline has the wrong country code');
assert(outline.features[0]?.geometry?.type === 'MultiPolygon', 'England outline must be a MultiPolygon');
assert(outline.metadata?.source?.includes('ONS Countries'), 'England outline source metadata is missing');

let outlineCoordinateCount = 0;
walkCoordinates(outline.features[0].geometry.coordinates, (longitude, latitude) => {
  assert(longitude >= -7.5 && longitude <= 2.5, 'England outline longitude is outside expected bounds');
  assert(latitude >= 49 && latitude <= 56.5, 'England outline latitude is outside expected bounds');
  outlineCoordinateCount += 1;
});
assert(outlineCoordinateCount > 100, 'England outline is unexpectedly sparse');

console.log(`Validated ${areas.length.toLocaleString()} mapped coverage districts and ${outlineCoordinateCount.toLocaleString()} England outline coordinates.`);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function walkCoordinates(value, visit) {
  if (Array.isArray(value) && value.length >= 2 && value.every(Number.isFinite)) {
    visit(value[0], value[1]);
    return;
  }
  assert(Array.isArray(value), 'GeoJSON coordinates contain an invalid value');
  for (const child of value) walkCoordinates(child, visit);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
