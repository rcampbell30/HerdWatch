export function selectMapCentroids(areas, reference) {
  if (!Array.isArray(areas) || areas.length === 0) throw new Error('Coverage area data is empty');
  if (!reference?.centroids || !reference?.metadata) throw new Error('ONS centroid reference is missing');
  const districts = areas.map(area => area.postcodeDistrict);
  if (new Set(districts).size !== districts.length) throw new Error('Duplicate coverage postcode districts');
  const missing = districts.filter(district => !Object.hasOwn(reference.centroids, district));
  if (missing.length) {
    throw new Error(`ONS reference has no centroid for: ${missing.join(', ')}. Refresh map geography from ONS; no coverage records have been dropped.`);
  }
  const centroids = Object.fromEntries([...districts].sort().map(district => [district, reference.centroids[district]]));
  return {
    metadata: {
      ...reference.metadata,
      areaCount: districts.length,
      postcodeUnitCount: Object.values(centroids).reduce((sum, point) => sum + point.postcodeUnitCount, 0),
      selection: 'Only districts represented in the current COVER dataset; selected from the complete England ONSPD reference pool.'
    },
    centroids
  };
}
