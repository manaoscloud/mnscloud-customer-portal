import { featureBounds, infraGisMapBase, type InfraGisMapConfig } from './map-config';

const config = (values: Partial<InfraGisMapConfig>): InfraGisMapConfig => ({
  provider: 'none',
  styleUrl: null,
  pmtilesUrl: null,
  attribution: null,
  centerLatitude: '-3.1',
  centerLongitude: '-60.02',
  zoom: '11',
  accessToken: null,
  ...values,
});

describe('InfraGIS portal map base', () => {
  it('uses the style URL, a plain background without a provider, and the platform view', () => {
    const style = infraGisMapBase(
      config({ provider: 'style', styleUrl: 'https://tiles.example/style.json' }),
    );
    expect(style.style).toBe('https://tiles.example/style.json');
    expect(style.center).toEqual([-60.02, -3.1]);
    expect(style.zoom).toBe(11);
    const blank = infraGisMapBase(config({ provider: 'style', styleUrl: null, zoom: 'x' }));
    expect(typeof blank.style).toBe('object');
    expect(blank.zoom).toBe(3.5);
  });

  it('adds the public token only to Mapbox requests', () => {
    const base = infraGisMapBase(
      config({
        provider: 'mapbox',
        styleUrl: 'https://api.mapbox.com/styles/v1/x',
        accessToken: 'pk.1',
      }),
    );
    expect(base.transformRequest?.('https://api.mapbox.com/v4/tiles?x=1').url).toBe(
      'https://api.mapbox.com/v4/tiles?x=1&access_token=pk.1',
    );
    expect(base.transformRequest?.('https://other.example/a.png').url).toBe(
      'https://other.example/a.png',
    );
  });

  it('renders own PMTiles files with the Protomaps flavor', () => {
    const base = infraGisMapBase(
      config({ provider: 'pmtiles', pmtilesUrl: 'https://files.example/br.pmtiles' }),
    );
    expect(base.pmtiles).toBe(true);
    const style = base.style as { sources: Record<string, { url: string }> };
    expect(style.sources['protomaps'].url).toBe('pmtiles://https://files.example/br.pmtiles');
  });

  it('frames points, lines and polygons, and nothing without geometry', () => {
    expect(
      featureBounds([
        { geometry: { coordinates: [-60, -3] } },
        {
          geometry: {
            coordinates: [
              [-61, -4],
              [-59.5, -2.5],
            ],
          },
        },
        {
          geometry: {
            coordinates: [
              [
                [-60.5, -3.5],
                [-60.2, -3.2],
                [-60.5, -3.5],
              ],
            ],
          },
        },
        { geometry: null },
      ]),
    ).toEqual([-61, -4, -59.5, -2.5]);
    expect(featureBounds([{ geometry: null }])).toBeNull();
  });
});
