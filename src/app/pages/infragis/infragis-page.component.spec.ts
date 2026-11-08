import { EXPORT_FORMATS, exportFileName } from './infragis-page.component';

describe('InfraGIS portal page helpers', () => {
  it('names the export after the account, without accents or symbols', () => {
    expect(exportFileName('Prefeitura de São João', 'geojson')).toBe(
      'infragis-prefeitura-de-sao-joao.geojson',
    );
    expect(exportFileName('  REDE / CENTRO  ', 'csv')).toBe('infragis-rede-centro.csv');
    expect(exportFileName('***', 'kml')).toBe('infragis-ativos.kml');
  });

  it('offers the export formats of the API, the shapefile as a zip', () => {
    expect(EXPORT_FORMATS.map((option) => option.format)).toEqual([
      'geojson',
      'csv',
      'kml',
      'kmz',
      'shapefile',
    ]);
    expect(EXPORT_FORMATS.find((option) => option.format === 'shapefile')?.extension).toBe('zip');
  });
});
