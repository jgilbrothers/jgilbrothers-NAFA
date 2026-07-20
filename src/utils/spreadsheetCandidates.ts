export interface SpreadsheetRowCandidate { id: string; documentId: string; sheetName: string; sourceRow: number; headerRow: number; cells: unknown[]; verificationStatus: 'needs_review' | 'confirmed' | 'corrected' | 'excluded' | 'disputed'; }

export function buildSpreadsheetRowCandidates(documentId: string, sheetName: string, rows: unknown[][], headerRow = 1): SpreadsheetRowCandidate[] {
  const firstDataIndex = Math.max(headerRow, 1);
  return rows
    .map((cells, index) => ({ cells, index }))
    .filter(({ cells, index }) => index >= firstDataIndex && Array.isArray(cells) && cells.some(cell => String(cell ?? '').trim()))
    .map(({ cells, index }) => ({ id: `SHEET-${documentId}-${encodeURIComponent(sheetName)}-${index + 1}`, documentId, sheetName, sourceRow: index + 1, headerRow, cells, verificationStatus: 'needs_review' }));
}
