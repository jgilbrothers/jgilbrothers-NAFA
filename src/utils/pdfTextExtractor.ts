export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  pageTexts: string[];
  status: 'succeeded' | 'failed' | 'needs_review';
  error?: string;
  confidence: number;
  readStatus: 'readable_text' | 'no_selectable_text' | 'partial_text' | 'failed';
}

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
  .replace(/\s+\n/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// Lightweight extraction scans PDF text fragments and does not provide court-ready page mapping.
// Per-page text is an approximate split unless a future full PDF reader is added.
export async function extractPdfText(blob: Blob): Promise<PdfTextExtractionResult> {
  try {
    const buffer = await blob.arrayBuffer();
    const raw = new TextDecoder('latin1').decode(buffer);
    const pageCount = Math.max((raw.match(/\/Type\s*\/Page\b/g) || []).length, 1);
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

    const text = cleanText(fragments.join('\n'));
    if (text.length < 20) {
      return { text, pageCount, pageTexts: text ? [text] : [], status: 'needs_review', confidence: 0.2, readStatus: 'no_selectable_text', error: 'NAFA Ledger could not find readable text in this PDF. This PDF may contain compressed or image-based text that the local lightweight reader cannot extract yet. OCR or an improved PDF reader will be needed in a later phase.' };
    }
    const perPageSize = Math.ceil(text.length / pageCount);
    const pageTexts = Array.from({ length: pageCount }, (_, idx) => text.slice(idx * perPageSize, (idx + 1) * perPageSize));
    return { text, pageCount, pageTexts, status: 'succeeded', confidence: text.length > 500 ? 0.85 : 0.65, readStatus: text.length > 500 ? 'readable_text' : 'partial_text' };
  } catch (err: any) {
    return { text: '', pageCount: 0, pageTexts: [], status: 'failed', confidence: 0, readStatus: 'failed', error: err?.message || 'PDF parsing failed locally.' };
  }
}
