import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { ingestDocument, routeDocument } from '../documentIngestion';
import { sha256 } from '../fileIntegrity';
import { extractLegalCandidates } from '../legalDocumentExtractor';
import { extractPdfText } from '../pdfTextExtractor';
import { buildSpreadsheetRowCandidates } from '../spreadsheetCandidates';

Object.assign(globalThis, { DOMParser });
const fixture = (name: string) => resolve('test/fixtures/synthetic', name);
const file = async (name: string, type: string) => new File([await readFile(fixture(name))], basename(name), { type });

describe('committed synthetic acceptance fixtures', () => {
  it('extracts the two-page text statement with exact page identity', async () => {
    const result = await extractPdfText(await file('synthetic-text-bank-statement.pdf', 'application/pdf'));
    expect(result.status).toBe('succeeded');
    expect(result.pageTexts).toHaveLength(2);
    expect(result.pageTexts[0]).toContain('01/29/2026');
    expect(result.pageTexts[1]).toContain('Closing balance');
    expect(result.pageMappingApproximate).toBe(false);
  });

  it('recognizes the image-only statement as requiring OCR without fabricating text', async () => {
    const result = await extractPdfText(await file('synthetic-scanned-bank-statement.pdf', 'application/pdf'));
    expect(result.pageTexts).toHaveLength(2);
    expect(result.pageTexts.join('').trim().length).toBeLessThan(20);
    expect(result.status).not.toBe('succeeded');
  });

  it('keeps legal allegations, findings, and orders separated', async () => {
    const order = await ingestDocument(await file('synthetic-legal-order.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    const candidates = extractLegalCandidates('DOC-LEGAL', order.pages.map(page => page.text));
    expect(candidates.map(candidate => candidate.kind)).toEqual(expect.arrayContaining(['allegation', 'finding', 'order']));
    expect(candidates.every(candidate => candidate.documentId === 'DOC-LEGAL')).toBe(true);

    const narrative = await ingestDocument(await file('synthetic-legal-narrative-no-order.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
    const narrativeCandidates = extractLegalCandidates('DOC-NARRATIVE', narrative.pages.map(page => page.text));
    expect(narrativeCandidates.some(candidate => candidate.kind === 'allegation')).toBe(true);
    expect(narrativeCandidates.some(candidate => candidate.kind === 'finding' || candidate.kind === 'order')).toBe(false);
  });

  it('retains workbook sheets, selectable header row, source rows, and malformed values', async () => {
    const result = await ingestDocument(await file('synthetic-financial-workbook.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
    const sheets = result.structuredData as Record<string, unknown[][]>;
    expect(Object.keys(sheets)).toEqual(['Transactions', 'Accounts', 'Notes']);
    const candidates = buildSpreadsheetRowCandidates('DOC-XLSX', 'Transactions', sheets.Transactions, 2);
    expect(candidates.map(candidate => candidate.sourceRow)).toEqual([3, 4, 6, 7, 8]);
    expect(candidates[2].cells).toContain('NOT-A-NUMBER');
    expect(candidates.every(candidate => candidate.verificationStatus === 'needs_review')).toBe(true);
  });

  it('parses quoted commas, alternate columns, malformed rows, and UTF-8 without finalizing candidates', async () => {
    const comma = await ingestDocument(await file('synthetic-comma.csv', 'text/csv'));
    const commaRows = comma.structuredData as string[][];
    expect(commaRows.find(row => row.includes('Quoted description, with comma'))).toBeTruthy();
    const debitCredit = await ingestDocument(await file('synthetic-debit-credit.csv', 'text/csv'));
    const rows = debitCredit.structuredData as string[][];
    expect(rows.some(row => row.includes('Café Example UTF-8'))).toBe(true);
    expect(rows.some(row => row[0] === 'malformed-row')).toBe(true);
    expect(debitCredit.warnings.join(' ')).toMatch(/not imported until confirmed/i);
  });

  it('routes the standalone receipt image and produces a stable content hash', async () => {
    const receipt = await file('synthetic-receipt.png', 'image/png');
    expect(await routeDocument(receipt)).toBe('image');
    expect(await sha256(receipt)).toBe(await sha256(receipt));
    expect(receipt.size).toBeGreaterThan(1_000);
  });
});
