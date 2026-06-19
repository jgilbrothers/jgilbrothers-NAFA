/**
 * NAFA Ledger optional AI enhancement hooks.
 *
 * This static Cloudflare Pages app is offline-first. These functions intentionally
 * do not call a hardcoded network service; callers should treat the returned rejection as
 * an optional enhancement being unavailable and continue local workflows.
 */

export interface APIErrorState {
  status: number;
  message: string;
}

const offlineOnly = async () => {
  throw new Error('Optional online AI enhancement is not configured. NAFA Ledger remains available offline.');
};

export async function otaExtractDocumentInfo(_filename: string, _file_type: string, _fileDataText?: string): Promise<any> {
  return offlineOnly();
}

export async function otaAnalyzeQuery(_query: string, _context: string): Promise<any> {
  return offlineOnly();
}

export async function otaCheckHealth(): Promise<any> {
  return Promise.resolve({ ok: true, mode: 'offline-first-static' });
}
