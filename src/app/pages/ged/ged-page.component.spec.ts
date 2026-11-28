import { describe, expect, it } from 'vitest';
import { downloadName } from './ged-page.component';

describe('downloadName', () => {
  it('uses the document title and the served type', () => {
    expect(downloadName('Contrato social 2026', 'application/pdf')).toBe('Contrato social 2026.pdf');
    expect(downloadName('RG frente', 'image/jpeg')).toBe('RG frente.jpg');
    expect(downloadName('Planta', 'image/png')).toBe('Planta.png');
  });

  it('removes path and control characters and falls back to a neutral name', () => {
    expect(downloadName('../a/b:c*?"<>|\u0001d', 'application/pdf')).toBe('.. a b c d.pdf');
    expect(downloadName('   ', 'application/pdf')).toBe('document.pdf');
    expect(downloadName('x', 'application/zip')).toBe('x.bin');
  });

  it('limits very long titles', () => {
    expect(downloadName('a'.repeat(300), 'application/pdf')).toBe('a'.repeat(120) + '.pdf');
  });
});
