import type { Transaction } from '../types';

export const isVerifiedTransaction = (transaction: Transaction): boolean => transaction.verification_status === 'confirmed' || transaction.verification_status === 'corrected' || transaction.manual_override === true;
export const verifiedTransactionsOnly = (transactions: Transaction[]) => transactions.filter(isVerifiedTransaction);
