import type { StoredExtractedText } from './extractedTextStorage';
import { runLocalImageOcr, type LocalOcrProgress } from './localOcr';
import { configurePdfWorker } from './pdfRuntime';
import type { PdfTextExtractionResult } from './pdfTextExtractor';

export interface PdfOcrPageResult { page: number; text: string; confidence?: number; engine: 'tesseract-local'; timestamp: string; status: 'succeeded' | 'needs_review' | 'failed'; error?: string; }
export interface PdfOcrProgress { page: number; totalPages: number; stage: 'rendering' | 'ocr'; ocr?: LocalOcrProgress; }

export const unreadablePdfPages = (pageTexts: string[], minimumMeaningfulCharacters = 10) => pageTexts
  .map((text, index) => ({ text, page: index + 1 }))
  .filter(item => item.text.trim().length < minimumMeaningfulCharacters)
  .map(item => item.page);

export async function renderPdfPage(blob: Blob, pageNumber: number, scale = 2): Promise<Blob> {
  const pdfjs = typeof DOMMatrix === 'undefined' ? await import('pdfjs-dist/legacy/build/pdf.mjs') : await import('pdfjs-dist');
  configurePdfWorker(pdfjs);
  const standardFontDataUrl = typeof window !== 'undefined' ? new URL(`${(import.meta as any).env?.BASE_URL || '/'}pdf/standard_fonts/`, window.location.origin).href : undefined;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), useWorkerFetch: false, isEvalSupported: false, standardFontDataUrl, verbosity: 0 }).promise;
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PDF page image could not be created.')), 'image/png'));
  } finally {
    await pdf.destroy();
  }
}

export async function ocrPdfPages(blob: Blob, pageNumbers: number[], totalPages: number, onProgress?: (progress: PdfOcrProgress) => void, signal?: AbortSignal, renderer = renderPdfPage): Promise<PdfOcrPageResult[]> {
  const results: PdfOcrPageResult[] = [];
  for (const page of pageNumbers) {
    if (signal?.aborted) throw new DOMException('OCR cancelled', 'AbortError');
    onProgress?.({ page, totalPages, stage: 'rendering' });
    try {
      const image = await renderer(blob, page);
      const result = await runLocalImageOcr(image, ocr => onProgress?.({ page, totalPages, stage: 'ocr', ocr }), signal);
      results.push({ page, text: result.text, confidence: result.confidence, engine: 'tesseract-local', timestamp: new Date().toISOString(), status: result.status });
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      results.push({ page, text: '', engine: 'tesseract-local', timestamp: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : 'OCR failed' });
    }
  }
  return results;
}

/** Merge is non-destructive: a failed/empty retry never replaces prior valid page text. */
export function mergePdfOcrResults(existing: StoredExtractedText | undefined, pageCount: number, results: PdfOcrPageResult[]): StoredExtractedText {
  const pageTexts = Array.from({ length: pageCount }, (_, index) => existing?.pageTexts[index] || '');
  const pageConfidences = Array.from({ length: pageCount }, (_, index) => existing?.pageConfidences?.[index]);
  const pageEngines = Array.from({ length: pageCount }, (_, index) => existing?.pageEngines?.[index] || existing?.parser || 'pdfjs');
  for (const result of results) {
    const index = result.page - 1;
    if (result.text.trim()) {
      pageTexts[index] = result.text;
      pageConfidences[index] = result.confidence;
      pageEngines[index] = result.engine;
    }
  }
  const retriedPages = new Set(results.map(result => result.page));
  const warnings = [...(existing?.warnings || []).filter(warning => {
    const page = warning.match(/^OCR page (\d+):/i)?.[1];
    return !page || !retriedPages.has(Number(page));
  }), ...results.filter(result => result.status !== 'succeeded').map(result => `OCR page ${result.page}: ${result.error || 'needs user review'}`)];
  return { documentId: existing?.documentId || '', text: pageTexts.map((text, index) => `--- Page ${index + 1} ---\n${text}`).join('\n\n'), pageTexts, pageCount, updatedAt: new Date().toISOString(), pageMappingApproximate: false, parser: results.some(result => result.text.trim()) ? 'ocr' : existing?.parser || 'pdfjs', warnings, pageConfidences, pageEngines };
}

/** Merge a PDF.js reread without erasing OCR text or provenance for still-unreadable pages. */
export function mergePdfTextReread(existing: StoredExtractedText | undefined, documentId: string, result: PdfTextExtractionResult, updatedAt = new Date().toISOString()): StoredExtractedText {
  const pageCount = Math.max(result.pageCount, existing?.pageCount || 0);
  const pageTexts = Array.from({ length: pageCount }, (_, index) => {
    const pdfText = result.pageTexts[index]?.trim() || '';
    return pdfText || existing?.pageTexts[index] || '';
  });
  const pageEngines = Array.from({ length: pageCount }, (_, index) => {
    const pdfText = result.pageTexts[index]?.trim() || '';
    return pdfText ? 'pdfjs' : existing?.pageEngines?.[index] || existing?.parser || 'pdfjs';
  });
  const pageConfidences = Array.from({ length: pageCount }, (_, index) => {
    const pdfText = result.pageTexts[index]?.trim() || '';
    return pdfText ? undefined : existing?.pageConfidences?.[index];
  });
  const warnings = Array.from(new Set([...(existing?.warnings || []), ...(result.warnings || [])]));
  const hasOcrPages = pageEngines.some(engine => engine === 'tesseract-local' || engine === 'ocr');
  return {
    documentId,
    text: pageTexts.map((text, index) => `--- Page ${index + 1} ---\n${text}`).join('\n\n'),
    pageTexts,
    pageCount,
    updatedAt,
    pageMappingApproximate: false,
    parser: hasOcrPages ? 'ocr' : 'pdfjs',
    warnings,
    pageConfidences,
    pageEngines,
    structuredData: existing?.structuredData,
  };
}
