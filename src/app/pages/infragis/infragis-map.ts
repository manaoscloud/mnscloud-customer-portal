import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  type MapGeoJSONFeature,
  NavigationControl,
  Popup,
  addProtocol,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { featureBounds, infraGisMapBase, type InfraGisMapConfig } from './map-config';

/** GeoJSON answer of `GET /customer-portal/infragis/map/features`. */
export type FeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: string;
    geometry: { type: string; coordinates: unknown } | null;
    properties: Record<string, unknown>;
  }[];
  total: number;
  truncated: boolean;
};

export type Box = { minLng: number; minLat: number; maxLng: number; maxLat: number };

/** Read-only map of one published account (this module loads MapLibre only when the map opens). */
export type PortalMap = { destroy(): void };

const SOURCE = 'infragis-assets';
const STYLES_ID = 'mcp-maplibre-styles';
const EMPTY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
  total: 0,
  truncated: false,
};
let pmtilesProtocol = false;

/**
 * MapLibre CSS ships as the lazy `maplibre.css` bundle (angular.json, inject: false) and its module
 * worker as same-origin assets under `maplibre/`, as the edge CSP allows no `blob:` workers.
 */
function ensureAssets() {
  setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
  if (document.getElementById(STYLES_ID)) return;
  const link = document.createElement('link');
  link.id = STYLES_ID;
  link.rel = 'stylesheet';
  link.href = 'maplibre.css';
  document.head.appendChild(link);
}

function clamp(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, value));
}

/** Popup text of an asset: built from text nodes, never from markup. */
function popupContent(properties: Record<string, unknown>): HTMLElement {
  const box = document.createElement('div');
  box.className = 'mcp-map-popup';
  const title = document.createElement('strong');
  title.textContent = String(properties['IgaName'] ?? '');
  box.appendChild(title);
  for (const key of ['AssetTypeName', 'AssetStatusName', 'ProjectName', 'LayerName']) {
    const value = properties[key];
    if (value === null || value === undefined || value === '') continue;
    const line = document.createElement('div');
    line.textContent = String(value);
    box.appendChild(line);
  }
  return box;
}

export function createPortalMap(
  container: HTMLElement,
  config: InfraGisMapConfig,
  lang: string,
  load: (box: Box) => Promise<FeatureCollection>,
  onLoaded: (collection: FeatureCollection) => void,
): PortalMap {
  ensureAssets();
  const base = infraGisMapBase(config, lang);
  if (base.pmtiles && !pmtilesProtocol) {
    addProtocol('pmtiles', new Protocol().tile);
    pmtilesProtocol = true;
  }
  const map = new MapLibreMap({
    container,
    style: base.style as string | StyleSpecification,
    center: base.center,
    zoom: base.zoom,
    transformRequest: base.transformRequest,
    attributionControl: false,
  });
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(
    new AttributionControl({ compact: true, customAttribution: base.attribution ?? undefined }),
  );

  let framed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let request = 0;

  const refresh = async () => {
    const current = ++request;
    const bounds = map.getBounds();
    // The first answer covers the whole world so the assets can be framed once.
    const box: Box = framed
      ? {
          minLng: clamp(bounds.getWest(), 180),
          minLat: clamp(bounds.getSouth(), 90),
          maxLng: clamp(bounds.getEast(), 180),
          maxLat: clamp(bounds.getNorth(), 90),
        }
      : { minLng: -180, minLat: -90, maxLng: 180, maxLat: 90 };
    let collection = EMPTY;
    try {
      collection = await load(box);
    } catch {
      collection = EMPTY;
    }
    if (current !== request) return;
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection as never);
    onLoaded(collection);
    if (!framed) {
      framed = true;
      const bbox = featureBounds(collection.features);
      if (bbox) map.fitBounds(bbox, { padding: 48, maxZoom: 17, duration: 0 });
    }
  };

  map.on('load', () => {
    map.addSource(SOURCE, { type: 'geojson', data: EMPTY as never });
    const color = ['coalesce', ['get', 'Color'], '#22C55E'] as never;
    map.addLayer({
      id: 'assets-fill',
      type: 'fill',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': color, 'fill-opacity': 0.25, 'fill-outline-color': color },
    });
    map.addLayer({
      id: 'assets-line',
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': color, 'line-width': 3 },
    });
    map.addLayer({
      id: 'assets-point',
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': color,
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    });
    for (const layer of ['assets-fill', 'assets-line', 'assets-point']) {
      map.on('click', layer, (event) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
        if (!feature) return;
        new Popup({ closeButton: true })
          .setLngLat(event.lngLat)
          .setDOMContent(popupContent(feature.properties ?? {}))
          .addTo(map);
      });
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    void refresh();
  });
  map.on('moveend', () => {
    if (!framed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void refresh(), 300);
  });

  return {
    destroy() {
      if (timer) clearTimeout(timer);
      request++;
      map.remove();
    },
  };
}
