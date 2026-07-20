import { afterEach, describe, expect, it, vi } from 'vitest';
import { findDuplicateHash, sha256 } from '../fileIntegrity';
import { routeDocument } from '../documentIngestion';
import { extractTransactionCandidates } from '../transactionExtractor';
import { extractLegalCandidates } from '../legalDocumentExtractor';
import { verifiedTransactionsOnly } from '../verifiedTransactions';
import type { Transaction } from '../../types';

describe('document integrity and routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('matches the known SHA-256 digest for a fixed synthetic payload', async () => {
    expect(await sha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('fails clearly when secure Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(sha256(new Blob(['synthetic']))).rejects.toThrow(/HTTPS or localhost/);
  });

  it('hashes identical bytes identically despite different filenames', async () => {
    const first = new File(['private synthetic fixture'], 'first.txt', { type: 'text/plain' });
    const second = new File(['private synthetic fixture'], 'renamed.bin');
    const hash = await sha256(first);
    expect(await sha256(second)).toBe(hash);
    expect(findDuplicateHash(hash, [{ id: 'one', sha256: hash }])?.id).toBe('one');
    expect(findDuplicateHash(await sha256(new Blob(['changed bytes'])), [{ id: 'one', sha256: hash }])).toBeUndefined();
  });

  it('uses file signatures before extensions and preserves unsupported files', async () => {
    expect(await routeDocument(new File(['%PDF-1.7 synthetic'], 'misnamed.bin'))).toBe('pdf');
    expect(await routeDocument(new File(['plain'], 'rows.csv', { type: 'text/csv' }))).toBe('csv');
    expect(await routeDocument(new File([new Uint8Array([1, 2, 3])], 'archive.bin'))).toBe('unsupported');
  });
});

describe('traceability and confirmation gating', () => {
  it('retains exact source page, line, excerpt, engine, and review state', () => {
    const candidates = extractTransactionCandidates('01/02 Coffee Shop 10.00', 'DOC-1', ['01/02 Coffee Shop 10.00'], { documentType: 'Checking Statement', statementPeriod: '12/15/2025 - 01/15/2026' });
    expect(candidates[0]).toMatchObject({ documentId: 'DOC-1', sourcePage: 1, sourceLine: 1, sourcePageApproximate: false, extractionEngine: 'pdfjs', verificationStatus: 'extracted' });
    expect(candidates[0].sourceExcerpt).toContain('Coffee Shop');
    expect(candidates[0].transactionDate).toBe('2026-01-02');
  });

  it('does not count extracted or disputed transactions', () => {
    const base = { transaction_id: 'x', transaction_date: '2026-01-01', raw_description: 'Synthetic', clean_vendor_name: 'Synthetic', amount: 10, transaction_type: 'debit', processing_method: 'Other', card_or_account_suffix: '0000', category: 'Miscellaneous', is_pending: false } as Transaction;
    const items = ['extracted', 'needs_review', 'confirmed', 'corrected', 'disputed'].map((verification_status, index) => ({ ...base, transaction_id: `${index}`, verification_status } as Transaction));
    expect(verifiedTransactionsOnly(items).map(item => item.verification_status)).toEqual(['confirmed', 'corrected']);
  });
});

describe('legal candidate separation', () => {
  it('never converts an allegation into a finding', () => {
    const candidates = extractLegalCandidates('LEGAL-1', ['Petitioner alleges funds were hidden. The court finds the account existed. It is ordered that records shall be produced.']);
    expect(candidates.map(candidate => candidate.kind)).toEqual(expect.arrayContaining(['allegation', 'finding', 'order']));
    expect(candidates.find(candidate => candidate.kind === 'allegation')?.verificationStatus).toBe('needs_review');
  });
});
