import { DocumentRecord } from '../types';

export interface TransactionCandidate {
  id: string;
  documentId: string;
  transactionDate: string;
  postedDate?: string;
  rawDescription: string;
  cleanMerchantName: string;
  amount: number;
  transactionType: 'debit' | 'credit' | 'unknown';
  runningBalance?: number;
  sourcePage?: number;
  sourcePageApproximate?: boolean;
  sourceLine?: number;
  confidenceScore: number;
  needsReview: boolean;
  reviewReason?: string;
  excluded?: boolean;
  note?: string;
}

export interface TransactionExtractionContext {
  documentType?: DocumentRecord['file_type'];
  accountType?: 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment';
  sourcePagesApproximate?: boolean;
  statementPeriod?: string;
}

const moneyPattern = /(?:[-+]?\$?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?|[-+]?\$?\(?\d+\.\d{2}\)?)/g;
const datePattern = /\b(?:\d{1,2}[\/]\d{1,2}(?:[\/]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})\b/;
const shortDatePattern = /^\d{1,2}\/\d{1,2}$/;
const balanceWords = /\b(balance|available|previous|ending|beginning|total|summary|minimum payment|interest charged)\b/i;
const debitClues = /\b(payment to|online payment to|ach payment to|bill pay|payment sent|debit card payment|pos|purchase|withdrawal|debit|atm|check|fee)\b/i;
const creditClues = /\b(payment received|deposit|direct deposit|payroll|refund|credit|reversal|cashback|interest paid)\b/i;
const genericPayment = /\bpayment\b/i;

const parseAmount = (value: string): number => {
  const trimmed = value.trim();
  const negative = trimmed.includes('(') || trimmed.startsWith('-') || trimmed.endsWith('-');
  const parsed = parseFloat(trimmed.replace(/[,$()+-]/g, '')) || 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const inferStatementYear = (statementPeriod?: string): string | undefined => {
  const years = [...(statementPeriod || '').matchAll(/\b(20\d{2}|19\d{2})\b/g)].map(match => match[1]);
  return years[0];
};

const normalizeTransactionDate = (rawDate: string, statementPeriod?: string): { date: string; inferredYear: boolean; needsReview: boolean; reason?: string } => {
  if (!shortDatePattern.test(rawDate)) return { date: rawDate, inferredYear: false, needsReview: false };
  const year = inferStatementYear(statementPeriod);
  if (!year) {
    return { date: rawDate, inferredYear: false, needsReview: true, reason: 'missing transaction year' };
  }
  const [month, day] = rawDate.split('/').map(part => part.padStart(2, '0'));
  return { date: `${year}-${month}-${day}`, inferredYear: true, needsReview: false };
};

const cleanMerchant = (description: string): string => description
  .replace(/\b(ACH|POS|DEBIT|CREDIT|PURCHASE|WITHDRAWAL)\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(/\s+/)
  .slice(0, 6)
  .join(' ') || 'Merchant unclear';

const inferTransactionType = (
  line: string,
  amount: number,
  context?: TransactionExtractionContext
): { type: TransactionCandidate['transactionType']; reason?: string } => {
  const isCheckingLike = context?.accountType === 'checking' || context?.accountType === 'savings' || context?.documentType === 'Checking Statement' || context?.documentType === 'Savings Statement';
  const isCreditCard = context?.accountType === 'credit_card' || context?.documentType === 'Credit Card Statement';
  const hasDebitClue = debitClues.test(line);
  const hasCreditClue = creditClues.test(line);
  const hasGenericPayment = genericPayment.test(line);

  if (hasDebitClue) return { type: 'debit' };
  if (amount < 0 && isCheckingLike) return { type: 'debit' };
  if (amount < 0 && isCreditCard) return { type: 'credit' };
  if (amount < 0) return { type: 'unknown', reason: 'signed negative amount without account context' };
  if (hasCreditClue) return { type: 'credit' };
  if (isCreditCard && hasGenericPayment) return { type: 'credit' };
  if (isCheckingLike && hasGenericPayment) return { type: 'debit' };
  if (hasGenericPayment) return { type: 'unknown', reason: 'ambiguous payment direction' };
  if (isCheckingLike && amount > 0) return { type: 'debit' };
  if (isCreditCard && amount > 0) return { type: 'debit' };
  return { type: 'unknown', reason: 'unclear debit/credit direction' };
};

export function extractTransactionCandidates(
  text: string,
  documentId: string,
  pageTexts?: string[],
  context?: TransactionExtractionContext
): TransactionCandidate[] {
  const pages = pageTexts?.length ? pageTexts : [text];
  const candidates: TransactionCandidate[] = [];

  pages.forEach((pageText, pageIndex) => {
    pageText.split(/\r?\n/).forEach((line, lineIndex) => {
      const clean = line.trim();
      if (clean.length < 8) return;
      const dateMatch = clean.match(datePattern);
      const amountMatches = clean.match(moneyPattern) || [];
      if (!dateMatch || amountMatches.length === 0) return;

      const isBalanceLine = balanceWords.test(clean) && amountMatches.length <= 1;
      const amount = parseAmount(amountMatches[0]);
      const runningBalance = amountMatches.length > 1 ? Math.abs(parseAmount(amountMatches[amountMatches.length - 1])) : undefined;
      let description = clean.replace(dateMatch[0], ' ');
      amountMatches.forEach(amountText => { description = description.replace(amountText, ' '); });
      description = description.replace(/\s+/g, ' ').trim();

      const normalizedDate = normalizeTransactionDate(dateMatch[0], context?.statementPeriod);
      const direction = inferTransactionType(clean, amount, context);
      const reviewReasons: string[] = [];
      if (isBalanceLine) reviewReasons.push('balance line detected but not transaction');
      if (!description || description.length < 3) reviewReasons.push('merchant unclear');
      if (!dateMatch[0]) reviewReasons.push('unclear date');
      if (normalizedDate.needsReview && normalizedDate.reason) reviewReasons.push(normalizedDate.reason);
      if (!Number.isFinite(amount) || amount === 0) reviewReasons.push('unclear amount');
      if (direction.reason) reviewReasons.push(direction.reason);
      if (amountMatches.length > 2) reviewReasons.push('statement format not recognized');

      const needsReview = reviewReasons.length > 0 || direction.type === 'unknown';
      candidates.push({
        id: `CAND-${documentId}-${pageIndex + 1}-${lineIndex + 1}`,
        documentId,
        transactionDate: normalizedDate.date,
        rawDescription: description || clean,
        cleanMerchantName: cleanMerchant(description),
        amount: Math.abs(amount),
        transactionType: direction.type,
        runningBalance,
        sourcePage: context?.sourcePagesApproximate ? undefined : pageIndex + 1,
        sourcePageApproximate: Boolean(context?.sourcePagesApproximate),
        sourceLine: lineIndex + 1,
        confidenceScore: needsReview ? 0.55 : 0.86,
        needsReview,
        reviewReason: reviewReasons.join('; ') || (normalizedDate.inferredYear ? 'year inferred from statement period' : undefined),
      });
    });
  });

  return candidates;
}
