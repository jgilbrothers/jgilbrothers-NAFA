import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalOcrAssetPaths } from '../localOcr';
import { getLocalPdfAssetPaths } from '../pdfRuntime';

describe('same-origin runtime asset paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses deterministic localhost URLs without a browser global', () => {
    vi.stubGlobal('window', undefined);
    expect(getLocalOcrAssetPaths()).toEqual({
      workerPath: 'http://localhost/ocr/worker.min.js',
      corePath: 'http://localhost/ocr/core/',
      langPath: 'http://localhost/ocr/lang/',
    });
    expect(getLocalPdfAssetPaths()).toEqual({
      workerSrc: 'http://localhost/pdf/pdf.worker.min.mjs',
      standardFontDataUrl: 'http://localhost/pdf/standard_fonts/',
    });
  });

  it('keeps assets on the deployed browser origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://preview.example.test' } });
    expect(new URL(getLocalOcrAssetPaths().workerPath).origin).toBe('https://preview.example.test');
    expect(new URL(getLocalPdfAssetPaths().workerSrc).origin).toBe('https://preview.example.test');
  });
});
