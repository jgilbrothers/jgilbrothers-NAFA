import { extractTransactionCandidates, type TransactionCandidate, type TransactionExtractionContext } from './transactionExtractor';

export interface SpreadsheetRowCandidate { id: string; documentId: string; sheetName: string; sourceRow: number; headerRow: number; cells: unknown[]; verificationStatus: 'needs_review' | 'confirmed' | 'corrected' | 'excluded' | 'disputed'; }
export interface SelectedWorkbookData { sheets: Record<string, unknown[][]>; selection: { sheetName: string; headerRow: number }; candidates?: SpreadsheetRowCandidate[]; }

export function buildSpreadsheetRowCandidates(documentId: string, sheetName: string, rows: unknown[][], headerRow = 1): SpreadsheetRowCandidate[] {
  const firstDataIndex = Math.max(headerRow, 1);
  return rows
    .map((cells, index) => ({ cells, index }))
    .filter(({ cells, index }) => index >= firstDataIndex && Array.isArray(cells) && cells.some(cell => String(cell ?? '').trim()))
    .map(({ cells, index }) => ({ id: `SHEET-${documentId}-${encodeURIComponent(sheetName)}-${index + 1}`, documentId, sheetName, sourceRow: index + 1, headerRow, cells, verificationStatus: 'needs_review' }));
}

/** Returns undefined only for legacy records that lack a usable persisted workbook selection. */
export function selectedWorkbookRows(documentId: string, structuredData: unknown): SpreadsheetRowCandidate[] | undefined {
  if (!structuredData || typeof structuredData !== 'object' || Array.isArray(structuredData)) return undefined;
  const data = structuredData as Partial<SelectedWorkbookData>;
  const sheetName = data.selection?.sheetName;
  const headerRow = data.selection?.headerRow;
  if (!data.sheets || typeof sheetName !== 'string' || !sheetName || !Number.isFinite(headerRow) || !Array.isArray(data.sheets[sheetName])) return undefined;
  return buildSpreadsheetRowCandidates(documentId, sheetName, data.sheets[sheetName], Math.max(1, Math.floor(headerRow!)));
}

export function extractSelectedWorkbookTransactions(
  rows: SpreadsheetRowCandidate[],
  context?: TransactionExtractionContext
): TransactionCandidate[] {
  return rows.flatMap(row => {
    const line = row.cells.map(cell => String(cell ?? '').replace(/[ \t\r\n]+/g, ' ').trim()).join(' ');
    return extractTransactionCandidates(line, row.documentId, undefined, { ...context, sourcePagesApproximate: true }).map(candidate => ({
      ...candidate,
      id: `${candidate.id}-${encodeURIComponent(row.sheetName)}-${row.sourceRow}`,
      sourcePage: undefined,
      sourcePageApproximate: true,
      sourceLine: row.sourceRow,
      sourceSheet: row.sheetName,
      sourceRow: row.sourceRow,
      extractionEngine: 'xlsx-selected-layout',
      verificationStatus: 'needs_review' as const,
      needsReview: true,
      reviewReason: candidate.reviewReason || 'Spreadsheet candidate must be reviewed before import',
    }));
  });
}
