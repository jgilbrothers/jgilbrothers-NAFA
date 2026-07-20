export interface SpreadsheetRowCandidate { id: string; documentId: string; sheetName: string; sourceRow: number; headerRow: number; cells: unknown[]; verificationStatus: 'needs_review' | 'confirmed' | 'corrected' | 'excluded' | 'disputed'; }

export function buildSpreadsheetRowCandidates(documentId: string, sheetName: string, rows: unknown[][], headerRow = 1): SpreadsheetRowCandidate[] {
  return rows.slice(Math.max(headerRow, 1)).filter(row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim())).map((cells, index) => ({ id: `SHEET-${documentId}-${encodeURIComponent(sheetName)}-${headerRow + index + 1}`, documentId, sheetName, sourceRow: headerRow + index + 1, headerRow, cells, verificationStatus: 'needs_review' }));
}
