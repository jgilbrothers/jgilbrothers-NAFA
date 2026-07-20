import { describe, expect, it } from 'vitest';
import { optionalGeminiNarrative } from '../aiAnalysisEngine';
import { ingestDocument } from '../documentIngestion';
import { getLocalOcrAssetPaths } from '../localOcr';
import { getLocalPdfWorkerPath } from '../pdfRuntime';

describe('local-by-default privacy boundary', () => {
  it('does not invoke fetch for local analysis or unsupported preservation', async () => {
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { calls += 1; throw new Error('network forbidden'); }) as typeof fetch;
    try {
      expect(await optionalGeminiNarrative('query', 'synthetic context', 'ignored-key')).toContain('Local Analysis Mode');
      const unsupported = await ingestDocument(new File([new Uint8Array([1, 2, 3])], 'synthetic.bin'));
      expect(unsupported.status).toBe('stored_only');
      expect(calls).toBe(0);
    } finally { globalThis.fetch = original; }
  });

  it('resolves OCR worker, core, and language assets to the application origin', () => {
    Object.assign(globalThis, { window: { location: { origin: 'https://nafa.example' } } });
    const paths = getLocalOcrAssetPaths();
    expect(Object.values(paths).every(path => path.startsWith('https://nafa.example/ocr/'))).toBe(true);
    expect(Object.values(paths).some(path => /cdn|projectnaptha/i.test(path))).toBe(false);
    expect(getLocalPdfWorkerPath()).toBe('https://nafa.example/pdf/pdf.worker.min.mjs');
  });
});
