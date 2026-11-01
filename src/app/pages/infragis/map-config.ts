import { layers, namedFlavor } from '@protomaps/basemaps';

/** Map base of the platform, as returned by `GET /customer-portal/infragis/map/config`. */
export type InfraGisMapConfig = {
  provider: 'style' | 'pmtiles' | 'mapbox' | 'none';
  styleUrl: string | null;
  pmtilesUrl: string | null;
  attribution: string | null;
  centerLatitude: number | string;
  centerLongitude: number | string;
  zoom: number | string;
  accessToken: string | null;
};

/** Style of the map (a URL or an inline style) with the request rewrite of the Mapbox provider. */
export type InfraGisMapBase = {
  style: string | Record<string, unknown>;
  pmtiles: boolean;
  transformRequest?: (url: string) => { url: string };
  attribution: string | null;
  center: [number, number];
  zoom: number;
};

// Fonts and sprites of the Protomaps basemap flavors (public assets of the Protomaps project).
const PROTOMAPS_ASSETS = 'https://protomaps.github.io/basemaps-assets';
const OSM_ATTRIBUTION = '© OpenStreetMap';

function blankStyle(): Record<string, unknown> {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef1f4' } }],
  };
}

/**
 * Same map base as the InfraGIS App map (`docs/infragis.md` → Map Provider Boundary): `style` is a
 * MapLibre style URL, `pmtiles` an own PMTiles file in the Protomaps light flavor, `mapbox` an
 * https Mapbox style whose requests receive the public token, and `none` a plain background.
 */
export function infraGisMapBase(config: InfraGisMapConfig, lang = 'pt'): InfraGisMapBase {
  const center: [number, number] = [
    Number(config.centerLongitude) || -51.9253,
    Number(config.centerLatitude) || -14.235,
  ];
  const zoom = Number(config.zoom);
  const base = {
    attribution: config.attribution,
    center,
    zoom: Number.isFinite(zoom) ? zoom : 3.5,
    pmtiles: false,
  };
  if (config.provider === 'pmtiles' && config.pmtilesUrl) {
    return {
      ...base,
      pmtiles: true,
      style: {
        version: 8,
        glyphs: `${PROTOMAPS_ASSETS}/fonts/{fontstack}/{range}.pbf`,
        sprite: `${PROTOMAPS_ASSETS}/sprites/v4/light`,
        sources: {
          protomaps: {
            type: 'vector',
            url: `pmtiles://${config.pmtilesUrl}`,
            attribution: OSM_ATTRIBUTION,
          },
        },
        layers: layers('protomaps', namedFlavor('light'), { lang }),
      },
    };
  }
  if (config.provider === 'mapbox' && config.styleUrl) {
    const token = config.accessToken;
    return {
      ...base,
      style: config.styleUrl,
      transformRequest: (url) =>
        token && url.startsWith('https://api.mapbox.com/')
          ? {
              url: `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
            }
          : { url },
    };
  }
  if (config.provider === 'style' && config.styleUrl) return { ...base, style: config.styleUrl };
  return { ...base, style: blankStyle() };
}

/** Box of the features of the first answer, to frame them once ([west, south, east, north]). */
export function featureBounds(
  features: readonly { geometry: { coordinates: unknown } | null }[],
): [number, number, number, number] | null {
  let box: [number, number, number, number] | null = null;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [lng, lat] = value as number[];
      box = box
        ? [
            Math.min(box[0], lng),
            Math.min(box[1], lat),
            Math.max(box[2], lng),
            Math.max(box[3], lat),
          ]
        : [lng, lat, lng, lat];
      return;
    }
    for (const item of value) visit(item);
  };
  for (const feature of features) visit(feature.geometry?.coordinates);
  return box;
}
