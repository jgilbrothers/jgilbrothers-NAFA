export type LocalOcrStatus = 'not_started' | 'running' | 'succeeded' | 'failed' | 'needs_review';
export type LocalOcrEngine = 'tesseract-local';
export interface LocalOcrProgress { status: string; progress?: number; userJobId?: string; }
export interface LocalOcrResult { text: string; confidence?: number; status: 'succeeded' | 'failed' | 'needs_review'; engine: LocalOcrEngine; }
export const LOCAL_OCR_LOAD_ERROR = 'Bundled local OCR could not be started. Reload the app and try again.';
export const isImageOcrSupported = (mimeType = '', filename = '') => mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(filename);
export const isPdfOcrCandidate = (mimeType = '', filename = '') => mimeType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

export const getLocalOcrAssetPaths = () => {
  const base = new URL(`${(import.meta as any).env?.BASE_URL || '/'}ocr/`, window.location.origin).href;
  return { workerPath: `${base}worker.min.js`, corePath: `${base}core/`, langPath: `${base}lang/` };
};

export async function loadTesseractEngine() {
  const module = await import('tesseract.js');
  return { module, engine: 'tesseract-local' as const };
}

export async function runLocalImageOcr(blob: Blob, onProgress?: (progress: LocalOcrProgress) => void, signal?: AbortSignal): Promise<LocalOcrResult> {
  if (signal?.aborted) throw new DOMException('OCR cancelled', 'AbortError');
  const { module } = await loadTesseractEngine();
  const assets = getLocalOcrAssetPaths();
  const worker = await module.createWorker('eng', module.OEM.LSTM_ONLY, {
    logger: message => onProgress?.(message as LocalOcrProgress),
    ...assets,
  });
  const abort = () => { void worker.terminate(); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await worker.recognize(blob);
    if (signal?.aborted) throw new DOMException('OCR cancelled', 'AbortError');
    const text = result.data.text || '';
    const confidence = typeof result.data.confidence === 'number' ? result.data.confidence / 100 : undefined;
    const status = text.trim() && (confidence === undefined || confidence >= 0.75) ? 'succeeded' : text.trim() ? 'needs_review' : 'failed';
    return { text, confidence, status, engine: 'tesseract-local' };
  } finally {
    signal?.removeEventListener('abort', abort);
    if (!signal?.aborted) await worker.terminate();
  }
}

export function extractReceiptFieldsFromText(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const amounts = [...text.matchAll(/\$?([0-9]+(?:,[0-9]{3})*\.[0-9]{2})/g)];
  const date = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/)?.[1];
  const paymentMethod = text.match(/\b(visa|mastercard|amex|discover|debit|credit|cash|paypal|apple pay|google pay)\b/i)?.[1];
  const merchant = lines.find(line => /[a-z]/i.test(line) && !/receipt|invoice|total|subtotal|tax|date/i.test(line))?.slice(0, 80);
  const rawAmount = amounts.at(-1)?.[1];
  const totalAmount = rawAmount ? Number(rawAmount.replace(/,/g, '')) : undefined;
  return { merchant, date, totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined, paymentMethod };
}
