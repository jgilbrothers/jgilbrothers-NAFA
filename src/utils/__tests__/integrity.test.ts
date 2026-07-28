import { afterEach, describe, expect, it, vi } from 'vitest';
import { findDuplicateHash, sha256 } from '../fileIntegrity';
import { routeDocument } from '../documentIngestion';
import { extractTransactionCandidates, sourcePagesAreApproximate } from '../transactionExtractor';
import { extractLegalCandidates } from '../legalDocumentExtractor';
import { isVerifiedTransaction, migrateLegacyTransactions, verifiedTransactionsOnly } from '../verifiedTransactions';
import type { Transaction } from '../../types';
import { calculateAggregates } from '../dataEngine';
import { MOCK_TRANSACTIONS } from '../../data/mockData';

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
  const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({ transaction_id: 'legacy', transaction_date: '2026-01-01', raw_description: 'Synthetic', clean_vendor_name: 'Synthetic', amount: 10, transaction_type: 'debit', processing_method: 'Other', card_or_account_suffix: '0000', category: 'Miscellaneous', is_pending: false, ...overrides });

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

  it('migrates only persisted legacy records and remains idempotent', () => {
    const original = transaction({ verification_status: undefined });
    expect(isVerifiedTransaction(original)).toBe(false);
    const migrated = migrateLegacyTransactions([original]);
    expect(migrated[0]).toMatchObject({ transaction_id: 'legacy', verification_status: 'confirmed' });
    expect(migrateLegacyTransactions(migrated)).toEqual(migrated);
  });

  it('keeps final states visible while excluding every non-final state', () => {
    const records = [
      transaction({ transaction_id: 'confirmed', verification_status: 'confirmed' }),
      transaction({ transaction_id: 'corrected', verification_status: 'corrected' }),
      transaction({ transaction_id: 'override', verification_status: 'needs_review', manual_override: true }),
      transaction({ transaction_id: 'pending', verification_status: 'extracted' }),
      transaction({ transaction_id: 'unconfirmed', verification_status: 'needs_review' }),
      transaction({ transaction_id: 'rejected', verification_status: 'excluded' }),
      transaction({ transaction_id: 'disputed', verification_status: 'disputed' }),
      transaction({ transaction_id: 'fresh-statusless' }),
    ];
    expect(verifiedTransactionsOnly(records).map(item => item.transaction_id)).toEqual(['confirmed', 'corrected']);
    expect(isVerifiedTransaction(records[2])).toBe(false);
  });

  it('preserves legacy totals after persistence migration and keeps sample data non-empty', () => {
    const migrated = migrateLegacyTransactions([transaction({ amount: 42, category: 'Groceries' })]);
    expect(calculateAggregates([], verifiedTransactionsOnly(migrated)).categorySpending).toEqual([{ name: 'Groceries', value: 42 }]);
    expect(verifiedTransactionsOnly(migrateLegacyTransactions(MOCK_TRANSACTIONS)).length).toBe(MOCK_TRANSACTIONS.length);
  });
});

describe('legal candidate separation', () => {
  it('never converts an allegation into a finding', () => {
    const candidates = extractLegalCandidates('LEGAL-1', ['Petitioner alleges funds were hidden. The court finds the account existed. It is ordered that records shall be produced.']);
    expect(candidates.map(candidate => candidate.kind)).toEqual(expect.arrayContaining(['allegation', 'finding', 'order']));
    expect(candidates.find(candidate => candidate.kind === 'allegation')?.verificationStatus).toBe('needs_review');
  });

  it('uses actual page mapping instead of fabricating DOCX or OCR citations', () => {
    const text = ['Petitioner alleges funds were hidden.'];
    expect(extractLegalCandidates('DOCX-1', text, 'none')[0].sourcePage).toBeUndefined();
    expect(extractLegalCandidates('PDF-1', text, 'exact')[0].sourcePage).toBe(1);
    expect(sourcePagesAreApproximate(false, true)).toBe(false);
    expect(sourcePagesAreApproximate(true, false)).toBe(true);
    expect(sourcePagesAreApproximate(undefined, undefined)).toBe(true);

    const exactOcr = extractTransactionCandidates('01/02 Coffee Shop 10.00', 'PDF-OCR', ['01/02 Coffee Shop 10.00'], {
      documentType: 'Checking Statement',
      sourcePagesApproximate: sourcePagesAreApproximate(false, false),
      statementPeriod: '12/15/2025 - 01/15/2026',
    });
    const approximate = extractTransactionCandidates('01/02 Coffee Shop 10.00', 'IMAGE-OCR', ['01/02 Coffee Shop 10.00'], {
      documentType: 'Checking Statement',
      sourcePagesApproximate: sourcePagesAreApproximate(true, true),
      statementPeriod: '12/15/2025 - 01/15/2026',
    });
    expect(exactOcr[0].sourcePage).toBe(1);
    expect(approximate[0].sourcePage).toBeUndefined();
  });
});
