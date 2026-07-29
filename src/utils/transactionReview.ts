import type { Transaction } from '../types';

export type ReviewFinalization = 'accepted' | 'materially_corrected';

export const finalizeReviewedTransaction = (
  transaction: Transaction,
  finalization: ReviewFinalization,
  finalizedAt = new Date().toISOString()
): Transaction => {
  if (transaction.verification_status !== 'needs_review') return transaction;
  return {
    ...transaction,
    verification_status: finalization === 'materially_corrected' ? 'corrected' : 'confirmed',
    last_updated: finalizedAt,
  };
};
