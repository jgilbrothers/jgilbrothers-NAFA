export type LocalOcrStatus = 'not_started' | 'running' | 'succeeded' | 'failed' | 'needs_review';

export interface LocalOcrProgress {
  status: string;
  progress?: number;
  userJobId?: string;
}

export interface LocalOcrResult {
  text: string;
  confidence?: number;
  engine: 'local';
}

export const LOCAL_OCR_INSTALL_ERROR = 'Local OCR engine is not installed. npm install tesseract.js failed with 403 Forbidden from https://registry.npmjs.org/tesseract.js in this environment, so OCR cannot run until the dependency is available.';

export const isImageOcrSupported = (mimeType = '', filename = '') => {
  const lower = filename.toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower);
};

export const isPdfOcrCandidate = (mimeType = '', filename = '') => mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

export async function runLocalImageOcr(blob: Blob, onProgress?: (progress: LocalOcrProgress) => void): Promise<LocalOcrResult> {
  let createWorker: any;
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const tesseract = await dynamicImport('tesseract.js');
    createWorker = tesseract.createWorker;
  } catch {
    throw new Error(LOCAL_OCR_INSTALL_ERROR);
  }

  if (typeof createWorker !== 'function') throw new Error('Local OCR engine loaded without a createWorker function. OCR cannot run in this browser.');

  const worker = await createWorker('eng', 1, {
    logger: (message: LocalOcrProgress) => onProgress?.(message),
  });

  try {
    const result = await worker.recognize(blob);
    const text = result?.data?.text || '';
    const confidence = typeof result?.data?.confidence === 'number' ? result.data.confidence / 100 : undefined;
    return { text, confidence, engine: 'local' };
  } finally {
    await worker.terminate();
  }
}

export function extractReceiptFieldsFromText(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const amountMatches = [...text.matchAll(/(?:total|amount due|balance due|paid)\s*[:\-]?\s*\$?([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/gi)];
  const fallbackAmounts = [...text.matchAll(/\$?([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/g)];
  const dateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/);
  const paymentMatch = text.match(/\b(visa|mastercard|amex|discover|debit|credit|cash|paypal|apple pay|google pay)\b/i);
  const merchant = lines.find(line => /[a-z]/i.test(line) && !/receipt|invoice|total|subtotal|tax|date/i.test(line))?.slice(0, 80);
  const amountText = amountMatches[0]?.[1] || fallbackAmounts[fallbackAmounts.length - 1]?.[1];
  const amount = amountText ? Number(amountText.replace(/,/g, '')) : undefined;
  return { merchant, date: dateMatch?.[1], totalAmount: Number.isFinite(amount) ? amount : undefined, paymentMethod: paymentMatch?.[1] };
}
