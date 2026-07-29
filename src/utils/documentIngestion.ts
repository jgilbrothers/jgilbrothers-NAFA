import { extractPdfText } from './pdfTextExtractor';
import { runLocalImageOcr } from './localOcr';
import { sha256 } from './fileIntegrity';
import type { DocumentRecord } from '../types';

export type IngestionKind = 'pdf' | 'image' | 'text' | 'csv' | 'docx' | 'xlsx' | 'unsupported';
export interface IngestedPage { page: number; text: string; confidence?: number; engine: string; }
export interface IngestionResult { kind: IngestionKind; checksum: string; status: 'read' | 'needs_review' | 'stored_only' | 'failed'; engine: string; pages: IngestedPage[]; text: string; warnings: string[]; structuredData?: unknown; pageMapping: 'exact' | 'approximate' | 'none'; }

export function officeIngestionDocumentUpdates(result: IngestionResult, timestamp = new Date().toISOString()): Partial<DocumentRecord> {
  const supportedKind = result.kind === 'docx' || result.kind === 'xlsx';
  const hasText = supportedKind && Boolean(result.text.trim());
  const failed = !supportedKind || result.status === 'stored_only' || result.status === 'failed' || !hasText;
  const warnings = result.warnings.length > 0
    ? result.warnings
    : [supportedKind ? 'The Office document did not contain readable text.' : 'The file could not be parsed as a supported DOCX or XLSX document.'];

  return {
    text_read: hasText,
    text_read_at: timestamp,
    extracted_text_available: hasText,
    extracted_text_id: undefined,
    text_source: hasText ? result.kind as 'docx' | 'xlsx' : undefined,
    text_parser: hasText ? (result.kind === 'docx' ? 'mammoth' : 'xlsx') : undefined,
    text_extraction_status: failed ? 'failed' : result.status === 'needs_review' ? 'needs_review' : 'succeeded',
    text_extraction_error: failed ? warnings.join(' ') : undefined,
    extraction_engine: result.engine,
    extraction_timestamp: timestamp,
    extraction_warnings: warnings,
    processing_status: 'Requires Verification',
  };
}

const signatures = {
  pdf: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 5)) === '%PDF-',
  zip: (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b,
  png: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8,
  webp: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
};

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value.length > 0)) rows.push(row);
      row = []; cell = '';
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(value => value.length > 0)) rows.push(row);
  return rows;
}

export async function routeDocument(file: File): Promise<IngestionKind> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const name = file.name.toLowerCase();
  if (signatures.pdf(bytes) || file.type === 'application/pdf') return 'pdf';
  if (signatures.png(bytes) || signatures.jpg(bytes) || signatures.webp(bytes) || file.type.startsWith('image/')) return 'image';
  if (file.type === 'text/csv' || name.endsWith('.csv')) return 'csv';
  if (file.type.startsWith('text/') || name.endsWith('.txt')) return 'text';
  if (signatures.zip(bytes) && (name.endsWith('.docx') || file.type.includes('wordprocessingml'))) return 'docx';
  if (signatures.zip(bytes) && (name.endsWith('.xlsx') || file.type.includes('spreadsheetml'))) return 'xlsx';
  return 'unsupported';
}

export async function ingestDocument(file: File, signal?: AbortSignal): Promise<IngestionResult> {
  const [kind, checksum] = await Promise.all([routeDocument(file), sha256(file)]);
  if (signal?.aborted) throw new DOMException('Ingestion cancelled', 'AbortError');
  if (kind === 'pdf') {
    const parsed = await extractPdfText(file);
    return { kind, checksum, status: parsed.status === 'succeeded' ? 'read' : parsed.status === 'needs_review' ? 'needs_review' : 'failed', engine: 'pdfjs', pages: parsed.pageTexts.map((text, index) => ({ page: index + 1, text, engine: 'pdfjs' })), text: parsed.text, warnings: parsed.warnings || [], pageMapping: 'exact' };
  }
  if (kind === 'image') {
    const parsed = await runLocalImageOcr(file, undefined, signal);
    return { kind, checksum, status: parsed.status === 'succeeded' ? 'read' : parsed.status === 'needs_review' ? 'needs_review' : 'failed', engine: parsed.engine, pages: [{ page: 1, text: parsed.text, confidence: parsed.confidence, engine: parsed.engine }], text: parsed.text, warnings: parsed.status === 'needs_review' ? ['OCR confidence requires user review.'] : [], pageMapping: 'exact' };
  }
  if (kind === 'text' || kind === 'csv') {
    const text = await file.text();
    const rows = kind === 'csv' ? parseCsvRows(text) : undefined;
    return { kind, checksum, status: 'read', engine: kind === 'csv' ? 'xlsx-csv' : 'browser-text', pages: [{ page: 1, text, engine: kind === 'csv' ? 'xlsx-csv' : 'browser-text' }], text, warnings: kind === 'csv' ? ['Rows are candidates only and are not imported until confirmed.'] : [], structuredData: rows, pageMapping: 'exact' };
  }
  if (kind === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const parsed = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { kind, checksum, status: parsed.messages.length ? 'needs_review' : 'read', engine: 'mammoth', pages: [{ page: 1, text: parsed.value, engine: 'mammoth' }], text: parsed.value, warnings: parsed.messages.map(message => message.message), pageMapping: 'none' };
  }
  if (kind === 'xlsx') {
    const { default: readXlsxFile, readSheetNames } = await import('read-excel-file');
    const sheetNames = await readSheetNames(file);
    const entries = await Promise.all(sheetNames.map(async name => [name, await readXlsxFile(file, { sheet: name })] as const));
    const sheets = Object.fromEntries(entries);
    const text = entries.map(([name, rows]) => `--- Sheet: ${name} ---\n${rows.map(row => row.map(cell => String(cell ?? '')).join(',')).join('\n')}`).join('\n');
    const sheetWarnings = entries.filter(([, rows]) => rows.length === 0 || rows.every(row => row.every(cell => String(cell ?? '').trim() === ''))).map(([name]) => `Sheet “${name}” is empty or malformed.`);
    return { kind, checksum, status: 'needs_review', engine: 'xlsx', pages: [{ page: 1, text, engine: 'xlsx' }], text, warnings: ['Select and confirm the relevant sheet, header row, and data rows before import.', ...sheetWarnings], structuredData: sheets, pageMapping: 'none' };
  }
  return { kind, checksum, status: 'stored_only', engine: 'none', pages: [], text: '', warnings: ['Stored but not readable automatically.'], pageMapping: 'none' };
}
