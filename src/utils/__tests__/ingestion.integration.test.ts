import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { ingestDocument, officeIngestionDocumentUpdates } from '../documentIngestion';
import { extractPdfText } from '../pdfTextExtractor';
import { mergePdfOcrResults, mergePdfTextReread, ocrPdfPages, unreadablePdfPages } from '../pdfPageOcr';
import * as localOcr from '../localOcr';
import { buildSpreadsheetRowCandidates } from '../spreadsheetCandidates';
import { getUploadedFile, saveUploadedFile } from '../fileStorage';
import { DOMParser } from '@xmldom/xmldom';

Object.assign(globalThis, { DOMParser, window: { indexedDB: globalThis.indexedDB, location: { origin: 'http://localhost' } } });

const makeTextPdf = async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage(); first.drawText('Synthetic statement page one', { x: 50, y: 700, font });
  const second = pdf.addPage(); second.drawText('Synthetic statement page two', { x: 50, y: 700, font });
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
};

const makeDocx = async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First synthetic paragraph.</w:t></w:r></w:p><w:p><w:r><w:t>Second synthetic paragraph.</w:t></w:r></w:p></w:body></w:document>`);
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'synthetic.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
};

const makeXlsx = async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Checking 0000" sheetId="1" r:id="rId1"/><sheet name="Legal Review" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`);
  const sheet = (rows: string[][]) => `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${cell}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  zip.file('xl/worksheets/sheet1.xml', sheet([['Date', 'Amount'], ['2026-01-02', '12.34']]));
  zip.file('xl/worksheets/sheet2.xml', sheet([['Finding'], ['Synthetic only']]));
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'synthetic.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

describe('real ingestion interfaces', () => {
  it('extracts a text PDF with exact page retention', async () => {
    const result = await extractPdfText(await makeTextPdf());
    expect(result.status).toBe('succeeded');
    expect(result.pageTexts).toHaveLength(2);
    expect(result.pageTexts[0]).toContain('page one');
    expect(result.pageTexts[1]).toContain('page two');
    expect(result.pageMappingApproximate).toBe(false);
  });

  it('routes and extracts DOCX paragraphs in order', async () => {
    const result = await ingestDocument(await makeDocx());
    expect(result.kind).toBe('docx');
    expect(result.text.indexOf('First synthetic')).toBeLessThan(result.text.indexOf('Second synthetic'));
    expect(officeIngestionDocumentUpdates(result)).toMatchObject({ text_read: true, extracted_text_available: true, text_source: 'docx', text_parser: 'mammoth', text_extraction_status: 'succeeded' });
  });

  it('routes XLSX and retains sheet names and source row order', async () => {
    const result = await ingestDocument(await makeXlsx());
    const sheets = result.structuredData as Record<string, unknown[][]>;
    expect(Object.keys(sheets)).toEqual(['Checking 0000', 'Legal Review']);
    expect(sheets['Checking 0000'][1]).toEqual(['2026-01-02', '12.34']);
    expect(result.status).toBe('needs_review');
    expect(officeIngestionDocumentUpdates(result)).toMatchObject({ text_read: true, extracted_text_available: true, text_source: 'xlsx', text_parser: 'xlsx', text_extraction_status: 'needs_review' });
    expect(buildSpreadsheetRowCandidates('DOC-XLSX', 'Checking 0000', sheets['Checking 0000'], 1)[0]).toMatchObject({ documentId: 'DOC-XLSX', sheetName: 'Checking 0000', sourceRow: 2, headerRow: 1, verificationStatus: 'needs_review' });
  });

  it.each([
    ['corrupt DOCX bytes', 'corrupt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['corrupt XLSX bytes', 'corrupt.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['a non-ZIP file renamed as DOCX', 'renamed.docx', 'application/octet-stream'],
    ['a non-ZIP file renamed as XLSX', 'renamed.xlsx', 'application/octet-stream'],
  ])('preserves %s and records extraction as a review failure', async (_label, name, type) => {
    const file = new File([new TextEncoder().encode('synthetic invalid Office content')], name, { type });
    const documentId = `DOC-${name}-${type}`;
    await saveUploadedFile(documentId, file);

    const result = await ingestDocument(file);
    const persistedRecord = JSON.parse(JSON.stringify({
      id: documentId,
      source_file_status: 'stored',
      local_file: { storage: 'indexeddb', stored: true },
      transactions_extracted: false,
      transaction_candidate_count: 0,
      confirmed_transaction_count: 0,
      ...officeIngestionDocumentUpdates(result, '2026-07-28T12:00:00.000Z'),
    }));

    expect(result).toMatchObject({ kind: 'unsupported', status: 'stored_only', text: '' });
    expect(persistedRecord).toMatchObject({
      source_file_status: 'stored',
      local_file: { storage: 'indexeddb', stored: true },
      text_read: false,
      extracted_text_available: false,
      text_extraction_status: 'failed',
      processing_status: 'Requires Verification',
      transactions_extracted: false,
      transaction_candidate_count: 0,
      confirmed_transaction_count: 0,
    });
    expect(persistedRecord).not.toHaveProperty('extracted_text_id');
    expect(persistedRecord).not.toHaveProperty('text_source');
    expect(persistedRecord.text_extraction_error).toMatch(/not readable|could not be parsed|stored/i);
    expect(await getUploadedFile(documentId)).toMatchObject({ documentId, originalFileName: name, size: file.size });
  });

  it('maps a synthetic unsupported Office result without falsely labeling it XLSX', () => {
    const updates = officeIngestionDocumentUpdates({
      kind: 'unsupported',
      checksum: 'synthetic',
      status: 'stored_only',
      engine: 'none',
      pages: [],
      text: '',
      warnings: ['The contents do not match the expected Office ZIP format.'],
      pageMapping: 'none',
    }, '2026-07-28T12:00:00.000Z');

    expect(updates).toMatchObject({
      text_read: false,
      extracted_text_available: false,
      text_extraction_status: 'failed',
      processing_status: 'Requires Verification',
    });
    expect(updates.text_source).toBeUndefined();
    expect(updates.text_parser).toBeUndefined();
    expect(updates.extracted_text_id).toBeUndefined();
    expect(updates.text_extraction_error).toContain('expected Office ZIP format');
  });

  it('identifies unreadable pages and preserves prior text across OCR failure and retry', () => {
    expect(unreadablePdfPages(['valid text on page one', '', 'x'])).toEqual([2, 3]);
    const prior = { documentId: 'DOC-OCR', text: 'old', pageTexts: ['valid old text', ''], pageCount: 2, updatedAt: 'before', parser: 'pdfjs' as const };
    const failed = mergePdfOcrResults(prior, 2, [{ page: 1, text: '', engine: 'tesseract-local', timestamp: 'now', status: 'failed', error: 'synthetic failure' }]);
    expect(failed.pageTexts[0]).toBe('valid old text');
    const retried = mergePdfOcrResults(failed, 2, [{ page: 2, text: 'recovered text', confidence: .91, engine: 'tesseract-local', timestamp: 'later', status: 'succeeded' }]);
    expect(retried.pageTexts).toEqual(['valid old text', 'recovered text']);
    expect(retried.warnings).toContain('OCR page 1: synthetic failure');
  });

  it('preserves OCR pages and provenance across repeated mixed-PDF rereads', () => {
    const existing = {
      documentId: 'DOC-MIXED',
      text: 'old',
      pageTexts: ['old selectable text', 'scanned page OCR'],
      pageCount: 2,
      updatedAt: 'before',
      parser: 'ocr' as const,
      warnings: ['OCR page 2 reviewed'],
      pageConfidences: [undefined, .93],
      pageEngines: ['pdfjs', 'tesseract-local'],
    };
    const reread = {
      text: 'updated',
      pageCount: 2,
      pageTexts: ['updated selectable text', ''],
      status: 'needs_review' as const,
      confidence: .75,
      readStatus: 'partial_text' as const,
      parser: 'pdfjs' as const,
      warnings: ['1 page(s) contained no selectable text and may require OCR.'],
      pageMappingApproximate: false as const,
    };
    const once = mergePdfTextReread(existing, 'DOC-MIXED', reread, '2026-07-28T12:00:00.000Z');
    const twice = mergePdfTextReread(once, 'DOC-MIXED', reread, '2026-07-28T12:00:00.000Z');

    expect(once.pageTexts).toEqual(['updated selectable text', 'scanned page OCR']);
    expect(once.pageEngines).toEqual(['pdfjs', 'tesseract-local']);
    expect(once.pageConfidences).toEqual([undefined, .93]);
    expect(once.parser).toBe('ocr');
    expect(once.warnings).toEqual(['OCR page 2 reviewed', '1 page(s) contained no selectable text and may require OCR.']);
    expect(twice).toEqual(once);
  });

  it('runs selected PDF pages through the renderer and local OCR with exact page identity', async () => {
    const recognize = vi.spyOn(localOcr, 'runLocalImageOcr').mockResolvedValue({ text: 'OCR page text', confidence: .93, status: 'succeeded', engine: 'tesseract-local' });
    const renderer = vi.fn(async () => new Blob(['rendered page'], { type: 'image/png' }));
    const progress: number[] = [];
    const results = await ocrPdfPages(new Blob(['pdf']), [2], 3, state => progress.push(state.page), undefined, renderer);
    expect(renderer).toHaveBeenCalledWith(expect.any(Blob), 2);
    expect(recognize).toHaveBeenCalledOnce();
    expect(results[0]).toMatchObject({ page: 2, text: 'OCR page text', confidence: .93, engine: 'tesseract-local', status: 'succeeded' });
    expect(progress).toContain(2);
    recognize.mockRestore();
  });
});
