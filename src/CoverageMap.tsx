import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { HerdArea, RiskStatus } from './types';

const POINT_SOURCE_ID = 'coverage-points';
const STANDARD_LAYER_ID = 'coverage-standard-sample';
const SMALL_LAYER_ID = 'coverage-small-sample';
const MAP_BOUNDS: [[number, number], [number, number]] = [[-6.7, 49.7], [2.1, 56.1]];

interface Centroid {
  longitude: number;
  latitude: number;
  postcodeUnitCount: number;
}

interface CentroidData {
  metadata: {
    source: string;
    sourceUrl: string;
    limitation: string;
  };
  centroids: Record<string, Centroid>;
}

interface EnglandOutline {
  type: 'FeatureCollection';
  metadata: {
    source: string;
    sourceUrl: string;
  };
  features: FeatureCollection['features'];
}

interface CoverageProperties {
  postcodeDistrict: string;
  region: string;
  coverage: number;
  practiceCount: number;
  totalEligible: number;
  totalVaccinated: number;
  status: RiskStatus;
}

type CoverageFeatureCollection = FeatureCollection<Point, CoverageProperties>;
type LoadState = 'loading' | 'ready' | 'error';

function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Map data request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

function toFeatureCollection(areas: HerdArea[], centroids: Record<string, Centroid>): CoverageFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: areas.flatMap((area) => {
      const point = centroids[area.postcodeDistrict];
      if (!point) return [];
      return [{
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [point.longitude, point.latitude]
        },
        properties: {
          postcodeDistrict: area.postcodeDistrict,
          region: area.region,
          coverage: area.coverage,
          practiceCount: area.practiceCount,
          totalEligible: area.totalEligible,
          totalVaccinated: area.totalVaccinated,
          status: area.status
        }
      }];
    })
  };
}

function buildStyle(outline: EnglandOutline, points: CoverageFeatureCollection): StyleSpecification {
  const statusColour: ExpressionSpecification = [
    'match',
    ['get', 'status'],
    'AT_RISK', '#b91c1c',
    'VULNERABLE', '#b45309',
    'PROTECTED', '#15803d',
    '#6b7280'
  ];

  return {
    version: 8,
    sources: {
      'england-outline': { type: 'geojson', data: outline },
      [POINT_SOURCE_ID]: { type: 'geojson', data: points }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#dbeafe' }
      },
      {
        id: 'england-land',
        type: 'fill',
        source: 'england-outline',
        paint: { 'fill-color': '#f8f7f4', 'fill-opacity': 1 }
      },
      {
        id: 'england-coast',
        type: 'line',
        source: 'england-outline',
        paint: { 'line-color': '#6b7280', 'line-width': 1.25, 'line-opacity': 0.8 }
      },
      {
        id: STANDARD_LAYER_ID,
        type: 'circle',
        source: POINT_SOURCE_ID,
        filter: ['>=', ['get', 'totalEligible'], 30],
        paint: {
          'circle-color': statusColour,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.25, 7, 5.5, 11, 9],
          'circle-opacity': 0.84,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 1.5]
        }
      },
      {
        id: SMALL_LAYER_ID,
        type: 'circle',
        source: POINT_SOURCE_ID,
        filter: ['<', ['get', 'totalEligible'], 30],
        paint: {
          'circle-color': statusColour,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.75, 7, 4.75, 11, 8],
          'circle-opacity': 0.32,
          'circle-stroke-color': '#111827',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 1.8]
        }
      }
    ]
  };
}

function fitToPoints(map: MapLibreMap, features: CoverageFeatureCollection['features'], animate: boolean) {
  if (features.length === 0) return;
  if (features.length === 1) {
    map.flyTo({ center: features[0].geometry.coordinates as [number, number], zoom: 9, duration: animate ? 700 : 0 });
    return;
  }

  const coordinates = features.map((feature) => feature.geometry.coordinates);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...coordinates.map(([longitude]) => longitude)), Math.min(...coordinates.map(([, latitude]) => latitude))],
    [Math.max(...coordinates.map(([longitude]) => longitude)), Math.max(...coordinates.map(([, latitude]) => latitude))]
  ];
  map.fitBounds(bounds, { padding: 42, maxZoom: 8, duration: animate ? 700 : 0 });
}

function statusLabel(status: RiskStatus): string {
  if (status === 'AT_RISK') return 'Well below target';
  if (status === 'VULNERABLE') return 'Below target';
  return 'Meets target';
}

function popupContent(area: HerdArea): HTMLElement {
  const root = document.createElement('article');
  root.className = 'coverage-popup';

  const title = document.createElement('a');
  title.className = 'coverage-popup-title';
  title.href = `/town/${area.postcodeDistrict.toLowerCase()}/`;
  title.textContent = `${area.postcodeDistrict} · ${area.coverage.toFixed(1)}%`;
  root.append(title);

  const status = document.createElement('p');
  status.className = `coverage-popup-status ${area.status.toLowerCase()}`;
  status.textContent = statusLabel(area.status);
  root.append(status);

  const summary = document.createElement('p');
  summary.textContent = `${area.practiceCount.toLocaleString()} ${area.practiceCount === 1 ? 'practice' : 'practices'} · ${area.totalEligible.toLocaleString()} eligible records`;
  root.append(summary);

  if (area.totalEligible < 30) {
    const warning = document.createElement('p');
    warning.className = 'coverage-popup-warning';
    warning.textContent = 'Small sample: this percentage can move sharply.';
    root.append(warning);
  }

  const link = document.createElement('a');
  link.className = 'coverage-popup-link';
  link.href = `/town/${area.postcodeDistrict.toLowerCase()}/`;
  link.textContent = 'Open area details →';
  root.append(link);
  return root;
}

export function CoverageMap({ allAreas, visibleAreas }: { allAreas: HerdArea[]; visibleAreas: HerdArea[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const centroidsRef = useRef<Record<string, Centroid>>({});
  const visibleAreasRef = useRef(visibleAreas);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  visibleAreasRef.current = visibleAreas;

  useEffect(() => {
    let cancelled = false;
    let activeMap: MapLibreMap | null = null;
    const areaByDistrict = new Map(allAreas.map((area) => [area.postcodeDistrict, area]));

    async function initialiseMap() {
      try {
        const [maplibre, centroidData, outline] = await Promise.all([
          import('maplibre-gl'),
          fetch('/data/map-centroids.json').then(responseJson<CentroidData>),
          fetch('/data/england-outline.geojson').then(responseJson<EnglandOutline>),
          import('maplibre-gl/dist/maplibre-gl.css')
        ]);

        if (cancelled || !hostRef.current) return;
        centroidsRef.current = centroidData.centroids;
        const initialPoints = toFeatureCollection(visibleAreasRef.current, centroidData.centroids);
        const map = new maplibre.Map({
          container: hostRef.current,
          style: buildStyle(outline, initialPoints),
          center: [-1.65, 52.85],
          zoom: 5,
          minZoom: 4,
          maxZoom: 12,
          maxBounds: MAP_BOUNDS,
          attributionControl: false
        });
        activeMap = map;
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibre.AttributionControl({
          compact: true,
          customAttribution: 'Contains OS data © Crown copyright and database right 2026 · Contains Royal Mail data © Royal Mail copyright and database right 2026 · <a href="https://www.ons.gov.uk/methodology/geography/geographicalproducts/postcodeproducts" target="_blank" rel="noreferrer">Source: ONS</a> licensed under <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">OGL v3.0</a>'
        }));

        map.once('load', () => {
          if (cancelled) return;
          const canvas = map.getCanvas();
          canvas.setAttribute('role', 'region');
          canvas.setAttribute('aria-label', 'Interactive England map of recorded MMR coverage by GP-practice postcode district');
          const latestPoints = toFeatureCollection(visibleAreasRef.current, centroidData.centroids);
          (map.getSource(POINT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(latestPoints);
          fitToPoints(map, latestPoints.features, false);
          setLoadState('ready');
        });

        for (const layerId of [STANDARD_LAYER_ID, SMALL_LAYER_ID]) {
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
          map.on('click', layerId, (event) => {
            const district = String(event.features?.[0]?.properties?.postcodeDistrict ?? '');
            const area = areaByDistrict.get(district);
            if (!area) return;
            new maplibre.Popup({ closeButton: true, maxWidth: '280px', offset: 8 })
              .setLngLat(event.lngLat)
              .setDOMContent(popupContent(area))
              .addTo(map);
          });
        }
      } catch (error) {
        console.error('Unable to initialise the coverage map', error);
        if (!cancelled) setLoadState('error');
      }
    }

    void initialiseMap();
    return () => {
      cancelled = true;
      activeMap?.remove();
      if (mapRef.current === activeMap) mapRef.current = null;
    };
  }, [allAreas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || Object.keys(centroidsRef.current).length === 0) return;
    const points = toFeatureCollection(visibleAreas, centroidsRef.current);
    const source = map.getSource(POINT_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(points);
    fitToPoints(map, points.features, true);
  }, [visibleAreas]);

  return (
    <div className="coverage-map-frame" aria-busy={loadState === 'loading'}>
      <div ref={hostRef} className="coverage-map" aria-hidden={loadState !== 'ready'} />
      {loadState === 'loading' ? <p className="coverage-map-message" role="status">Loading geographic coverage map…</p> : null}
      {loadState === 'error' ? <p className="coverage-map-message error" role="alert">The geographic map could not load. The complete filterable table remains available below.</p> : null}
    </div>
  );
}
