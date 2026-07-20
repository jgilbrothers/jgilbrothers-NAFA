import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { ingestDocument } from '../documentIngestion';
import { extractPdfText } from '../pdfTextExtractor';
import { mergePdfOcrResults, ocrPdfPages, unreadablePdfPages } from '../pdfPageOcr';
import * as localOcr from '../localOcr';
import { buildSpreadsheetRowCandidates } from '../spreadsheetCandidates';
import { DOMParser } from '@xmldom/xmldom';

Object.assign(globalThis, { DOMParser });

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
  });

  it('routes XLSX and retains sheet names and source row order', async () => {
    const result = await ingestDocument(await makeXlsx());
    const sheets = result.structuredData as Record<string, unknown[][]>;
    expect(Object.keys(sheets)).toEqual(['Checking 0000', 'Legal Review']);
    expect(sheets['Checking 0000'][1]).toEqual(['2026-01-02', '12.34']);
    expect(result.status).toBe('needs_review');
    expect(buildSpreadsheetRowCandidates('DOC-XLSX', 'Checking 0000', sheets['Checking 0000'], 1)[0]).toMatchObject({ documentId: 'DOC-XLSX', sheetName: 'Checking 0000', sourceRow: 2, headerRow: 1, verificationStatus: 'needs_review' });
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
