export type LocalOcrStatus = 'not_started' | 'running' | 'succeeded' | 'failed' | 'needs_review';
export type LocalOcrEngine = 'tesseract-local' | 'tesseract-cdn';

export interface LocalOcrProgress {
  status: string;
  progress?: number;
  userJobId?: string;
}

export interface LocalOcrResult {
  text: string;
  confidence?: number;
  status: 'succeeded' | 'failed' | 'needs_review';
  engine: LocalOcrEngine;
}

interface TesseractModule {
  createWorker: (
    language?: string,
    oem?: number,
    options?: Record<string, unknown>
  ) => Promise<{
    recognize: (image: Blob) => Promise<{ data?: { text?: string; confidence?: number } }>;
    terminate: () => Promise<void>;
  }>;
}

const OCR_LOAD_ERROR = 'Local OCR engine could not be loaded. Check your internet connection or OCR engine setup.';
const TESSERACT_CDN_MODULE_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/+esm';
const TESSERACT_CDN_WORKER_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js';
const TESSERACT_CDN_CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0';
const TESSERACT_CDN_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0';

export const LOCAL_OCR_LOAD_ERROR = OCR_LOAD_ERROR;

export const isImageOcrSupported = (mimeType = '', filename = '') => {
  const lower = filename.toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(lower);
};

export const isPdfOcrCandidate = (mimeType = '', filename = '') => mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

async function loadTesseractFromCdn(): Promise<{ module: TesseractModule; engine: LocalOcrEngine }> {
  try {
    const module = await import(/* @vite-ignore */ TESSERACT_CDN_MODULE_URL) as TesseractModule;
    if (typeof module.createWorker !== 'function') throw new Error('createWorker missing');
    return { module, engine: 'tesseract-cdn' };
  } catch (err) {
    console.error('Unable to load Tesseract.js from CDN fallback.', err);
    throw new Error(OCR_LOAD_ERROR);
  }
}

export async function loadTesseractEngine(): Promise<{ module: TesseractModule; engine: LocalOcrEngine }> {
  return loadTesseractFromCdn();
}

export async function runLocalImageOcr(blob: Blob, onProgress?: (progress: LocalOcrProgress) => void): Promise<LocalOcrResult> {
  const { module, engine } = await loadTesseractEngine();
  const workerOptions: Record<string, unknown> = {
    logger: (message: LocalOcrProgress) => onProgress?.(message),
  };

  if (engine === 'tesseract-cdn') {
    workerOptions.workerPath = TESSERACT_CDN_WORKER_URL;
    workerOptions.corePath = TESSERACT_CDN_CORE_PATH;
    workerOptions.langPath = TESSERACT_CDN_LANG_PATH;
  }

  const worker = await module.createWorker('eng', 1, workerOptions);

  try {
    const result = await worker.recognize(blob);
    const text = result?.data?.text || '';
    const confidence = typeof result?.data?.confidence === 'number' ? result.data.confidence / 100 : undefined;
    const status = (text || '').trim() && (confidence === undefined || confidence >= 0.75) ? 'succeeded' : (text || '').trim() ? 'needs_review' : 'failed';
    return { text, confidence, status, engine };
  } finally {
    await worker.terminate();
  }
}

export function extractReceiptFieldsFromText(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const amountMatches = [...text.matchAll(/\b(total|amount due|balance due|paid)\b\s*[:\-]?\s*\$?([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/gi)];
  const fallbackAmounts = [...text.matchAll(/\$?([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/g)];
  const dateMatch = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/);
  const paymentMatch = text.match(/\b(visa|mastercard|amex|discover|debit|credit|cash|paypal|apple pay|google pay)\b/i);
  const merchant = lines.find(line => /[a-z]/i.test(line) && !/receipt|invoice|total|subtotal|tax|date/i.test(line))?.slice(0, 80);
  const amountText = amountMatches[0]?.[2] || fallbackAmounts[fallbackAmounts.length - 1]?.[1];
  const amount = amountText ? Number(amountText.replace(/,/g, '')) : undefined;
  return { merchant, date: dateMatch?.[1], totalAmount: Number.isFinite(amount) ? amount : undefined, paymentMethod: paymentMatch?.[1] };
}
