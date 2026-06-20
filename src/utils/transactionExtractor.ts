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
  sourceLine?: number;
  confidenceScore: number;
  needsReview: boolean;
  reviewReason?: string;
  excluded?: boolean;
  note?: string;
}

const moneyPattern = /(?:[-+]?\$?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?|[-+]?\$?\(?\d+\.\d{2}\)?)/g;
const datePattern = /\b(?:\d{1,2}[\/]\d{1,2}(?:[\/]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})\b/;
const balanceWords = /\b(balance|available|previous|ending|beginning|total|summary|minimum payment|interest charged)\b/i;
const creditWords = /\b(payment|deposit|credit|refund|payroll|direct dep|interest paid)\b/i;
const debitWords = /\b(debit|withdrawal|purchase|ach|pos|atm|check|fee|payment to)\b/i;

const parseAmount = (value: string): number => {
  const trimmed = value.trim();
  const negative = trimmed.includes('(') || trimmed.startsWith('-') || trimmed.endsWith('-');
  const parsed = parseFloat(trimmed.replace(/[,$()+-]/g, '')) || 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const cleanMerchant = (description: string): string => description
  .replace(/\b(ACH|POS|DEBIT|CREDIT|PURCHASE|WITHDRAWAL)\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(/\s+/)
  .slice(0, 6)
  .join(' ') || 'Merchant unclear';

export function extractTransactionCandidates(text: string, documentId: string, pageTexts?: string[]): TransactionCandidate[] {
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

      let type: TransactionCandidate['transactionType'] = 'unknown';
      const lower = clean.toLowerCase();
      if (creditWords.test(lower) || amount < 0) type = 'credit';
      if (debitWords.test(lower) && !creditWords.test(lower)) type = 'debit';
      if (type === 'unknown' && amount > 0) type = 'debit';

      const reviewReasons: string[] = [];
      if (isBalanceLine) reviewReasons.push('balance line detected but not transaction');
      if (!description || description.length < 3) reviewReasons.push('merchant unclear');
      if (!dateMatch[0]) reviewReasons.push('unclear date');
      if (!Number.isFinite(amount) || amount === 0) reviewReasons.push('unclear amount');
      if (type === 'unknown') reviewReasons.push('unclear debit/credit direction');

      const needsReview = reviewReasons.length > 0 || amountMatches.length > 2;
      candidates.push({
        id: `CAND-${documentId}-${pageIndex + 1}-${lineIndex + 1}`,
        documentId,
        transactionDate: dateMatch[0],
        rawDescription: description || clean,
        cleanMerchantName: cleanMerchant(description),
        amount: Math.abs(amount),
        transactionType: type,
        runningBalance,
        sourcePage: pageIndex + 1,
        sourceLine: lineIndex + 1,
        confidenceScore: needsReview ? 0.55 : 0.86,
        needsReview,
        reviewReason: reviewReasons.join('; ') || undefined,
      });
    });
  });

  return candidates;
}
