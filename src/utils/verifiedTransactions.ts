import type { Transaction } from '../types';

export const isVerifiedTransaction = (transaction: Transaction): boolean => transaction.verification_status === 'confirmed' || transaction.verification_status === 'corrected' || transaction.manual_override === true;
export const verifiedTransactionsOnly = (transactions: Transaction[]) => transactions.filter(isVerifiedTransaction);

/**
 * Persisted ledgers created before confirmation gating have no verification
 * status. Migrate only at trusted persistence/sample/archive boundaries so a
 * newly extracted status-less candidate can never become final by predicate.
 */
export const migrateLegacyTransactions = (transactions: Transaction[]): Transaction[] => transactions.map(transaction =>
  transaction.verification_status === undefined
    ? { ...transaction, verification_status: 'confirmed' as const }
    : transaction
);
