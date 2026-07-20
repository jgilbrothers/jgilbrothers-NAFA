export async function sha256(input: Blob | ArrayBuffer): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SHA-256 integrity checking is unavailable. Open NAFA Ledger over HTTPS or localhost and try again.');
  }
  const bytes = input instanceof Blob ? await input.arrayBuffer() : input;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function findDuplicateHash<T extends { id: string; sha256?: string }>(hash: string, documents: T[], excludeId?: string): T | undefined {
  return documents.find(document => document.id !== excludeId && document.sha256 === hash);
}
