export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  pageTexts: string[];
  status: 'succeeded' | 'failed' | 'needs_review';
  error?: string;
  confidence: number;
  readStatus: 'readable_text' | 'no_selectable_text' | 'partial_text' | 'failed';
  parser: 'pdfjs-dist' | 'lightweight-fallback';
  warning?: string;
}

const PDFJS_INSTALL_BLOCKED_WARNING = 'pdfjs-dist could not be installed in this environment: npm install pdfjs-dist returned 403 Forbidden from https://registry.npmjs.org/pdfjs-dist. NAFA Ledger is using the existing lightweight local reader as a visible fallback; scanned, image-based, encrypted, or compressed PDFs may require OCR later.';

const decodePdfEscapes = (value: string): string => value
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\n')
  .replace(/\\t/g, ' ')
  .replace(/\\\(/g, '(')
  .replace(/\\\)/g, ')')
  .replace(/\\\\/g, '\\')
  .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));

const cleanText = (value: string): string => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const extractTextFragments = (raw: string): string => {
  const fragments: string[] = [];
  const literalRegex = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = literalRegex.exec(raw))) {
    fragments.push(decodePdfEscapes(literalMatch[0].replace(/\)\s*(?:Tj|'|")$/, '').slice(1)));
  }

  const arrayRegex = /\[((?:\s*\((?:\\.|[^\\()])*\)\s*-?\d*\.?\d*)+)\]\s*TJ/g;
  let arrayMatch: RegExpExecArray | null;
  while ((arrayMatch = arrayRegex.exec(raw))) {
    const parts = [...arrayMatch[1].matchAll(/\((?:\\.|[^\\()])*\)/g)].map(m => decodePdfEscapes(m[0].slice(1, -1)));
    fragments.push(parts.join(''));
  }
  return cleanText(fragments.join('\n'));
};

const compactForCoverage = (value: string): string => value.replace(/\s+/g, '');

const hasSubstantialTextCoverage = (fullText: string, pageTexts: string[]): boolean => {
  const fullCompact = compactForCoverage(fullText);
  const pagesCompact = compactForCoverage(pageTexts.join('\n'));
  if (!fullCompact) return false;
  return pagesCompact.length / fullCompact.length >= 0.85;
};

const splitEvenlyOverFullText = (text: string, pageCount: number): string[] => {
  const safePageCount = Math.max(pageCount, 1);
  const perPageSize = Math.max(1, Math.ceil(text.length / safePageCount));
  return Array.from({ length: safePageCount }, (_, idx) => text.slice(idx * perPageSize, (idx + 1) * perPageSize)).filter(Boolean);
};

const splitApproximatePages = (raw: string, text: string, pageCount: number): string[] => {
  const pageMarkers = [...raw.matchAll(/\/Type\s*\/Page\b/g)].map(m => m.index || 0);
  if (pageMarkers.length > 1) {
    const pageTexts = pageMarkers.map((start, index) => {
      const end = pageMarkers[index + 1] || raw.length;
      return extractTextFragments(raw.slice(start, end));
    });
    const hasEveryPage = pageTexts.length === pageCount && pageTexts.every(page => page.trim().length > 0);
    if (hasEveryPage && hasSubstantialTextCoverage(text, pageTexts)) return pageTexts;
  }

  // PDF object order is not guaranteed. If page-object slices do not substantially cover
  // the full extracted text, keep all text by evenly splitting the full extraction instead.
  return splitEvenlyOverFullText(text, pageCount);
};

// pdfjs-dist installation was attempted for this patch but blocked by registry/security policy.
// This fallback remains intentionally visible through `warning` so callers do not silently trust it as a full parser.
export async function extractPdfText(blob: Blob): Promise<PdfTextExtractionResult> {
  try {
    const buffer = await blob.arrayBuffer();
    const raw = new TextDecoder('latin1').decode(buffer);
    const pageCount = Math.max((raw.match(/\/Type\s*\/Page\b/g) || []).length, 1);
    const text = extractTextFragments(raw);

    if (text.length < 20) {
      return { text, pageCount, pageTexts: text ? [text] : [], status: 'needs_review', confidence: 0.2, readStatus: 'no_selectable_text', parser: 'lightweight-fallback', warning: PDFJS_INSTALL_BLOCKED_WARNING, error: 'This PDF may be scanned, image-based, encrypted, or compressed. OCR may be needed later.' };
    }

    const pageTexts = splitApproximatePages(raw, text, pageCount);
    return { text, pageCount, pageTexts, status: 'succeeded', confidence: text.length > 500 ? 0.78 : 0.58, readStatus: text.length > 500 ? 'readable_text' : 'partial_text', parser: 'lightweight-fallback', warning: PDFJS_INSTALL_BLOCKED_WARNING };
  } catch (err: any) {
    return { text: '', pageCount: 0, pageTexts: [], status: 'failed', confidence: 0, readStatus: 'failed', parser: 'lightweight-fallback', warning: PDFJS_INSTALL_BLOCKED_WARNING, error: err?.message || 'PDF parsing failed locally. This PDF may be scanned, image-based, encrypted, or compressed. OCR may be needed later.' };
  }
}
