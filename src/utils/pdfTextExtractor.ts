import { configurePdfWorker } from './pdfRuntime';

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  pageTexts: string[];
  status: 'succeeded' | 'failed' | 'needs_review';
  error?: string;
  confidence: number;
  readStatus: 'readable_text' | 'no_selectable_text' | 'partial_text' | 'failed';
  parser: 'pdfjs';
  warnings?: string[];
  warning?: string;
  pageMappingApproximate: false;
}

const NO_TEXT = 'PDF.js found no selectable text. The PDF may be scanned or image-based; run local OCR.';

/** Extracts selectable text page-by-page. Page array indexes always map to PDF page numbers. */
export async function extractPdfText(blob: Blob): Promise<PdfTextExtractionResult> {
  try {
    const pdfjs = typeof DOMMatrix === 'undefined' ? await import('pdfjs-dist/legacy/build/pdf.mjs') : await import('pdfjs-dist');
    configurePdfWorker(pdfjs);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const standardFontDataUrl = typeof window !== 'undefined' ? new URL(`${(import.meta as any).env?.BASE_URL || '/'}pdf/standard_fonts/`, window.location.origin).href : undefined;
    const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, standardFontDataUrl, verbosity: 0 });
    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      pageTexts.push(text);
      page.cleanup();
    }
    await pdf.destroy();
    const text = pageTexts.map((page, index) => `--- Page ${index + 1} ---\n${page}`).join('\n\n');
    const readablePages = pageTexts.filter(page => page.trim().length >= 10).length;
    if (readablePages === 0) {
      return { text: '', pageCount: pageTexts.length, pageTexts, status: 'needs_review', confidence: 0, readStatus: 'no_selectable_text', parser: 'pdfjs', warnings: [NO_TEXT], warning: NO_TEXT, error: NO_TEXT, pageMappingApproximate: false };
    }
    const partial = readablePages < pageTexts.length;
    const warnings = partial ? [`${pageTexts.length - readablePages} page(s) contained no selectable text and may require OCR.`] : [];
    return { text, pageCount: pageTexts.length, pageTexts, status: partial ? 'needs_review' : 'succeeded', confidence: partial ? 0.75 : 0.98, readStatus: partial ? 'partial_text' : 'readable_text', parser: 'pdfjs', warnings, warning: warnings[0], pageMappingApproximate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown PDF.js error';
    return { text: '', pageCount: 0, pageTexts: [], status: 'failed', confidence: 0, readStatus: 'failed', parser: 'pdfjs', warnings: [`PDF.js could not read this file: ${message}`], error: `PDF.js could not read this file: ${message}`, pageMappingApproximate: false };
  }
}
