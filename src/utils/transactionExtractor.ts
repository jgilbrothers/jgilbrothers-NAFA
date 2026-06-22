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

const moneyPattern = /(?:[-+]?\$?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?-?|[-+]?\$?\(?\d+\.\d{2}\)?-?)/g;
const datePattern = /\b(?:\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}-\d{1,2}-\d{1,2})\b/;
const shortDatePattern = /^\d{1,2}[\/-]\d{1,2}$/;
const datedWithYearPattern = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/;
const balanceWords = /\b(balance|available|previous|ending|beginning|total|summary|minimum payment|interest charged)\b/i;
const debitClues = /\b(payment to|online payment to|ach payment to|bill pay|payment sent|debit card payment|pos|purchase|withdrawal|debit|debit card|atm|check|share draft|fee|secu card|usaa debit)\b/i;
const creditClues = /\b(payment received|deposit|direct deposit|payroll|refund|credit|reversal|cashback|interest paid|mobile deposit|ach credit|remote deposit)\b/i;
const genericPayment = /\bpayment\b/i;

const parseAmount = (value: string): number => {
  const trimmed = value.trim();
  const negative = trimmed.includes('(') || trimmed.startsWith('-') || trimmed.endsWith('-');
  const parsed = parseFloat(trimmed.replace(/[,$()+-]/g, '')) || 0;
  return negative ? -Math.abs(parsed) : parsed;
};

const findTransactionDates = (line: string): string[] => [...line.matchAll(new RegExp(datePattern.source, 'g'))].map(m => m[0]);

const getLeadingDateColumns = (line: string): { postedDate: string; effectiveDate?: string; hasDescriptionDate: boolean } | undefined => {
  const leading = line.match(/^\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)(?:\s+(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?))?/);
  if (!leading) return undefined;
  const remainingAfterLeadingDates = line.slice(leading[0].length);
  return {
    postedDate: leading[1],
    effectiveDate: leading[2],
    hasDescriptionDate: datePattern.test(remainingAfterLeadingDates),
  };
};

const inferAmountColumns = (line: string, amounts: string[]): { amount: number; runningBalance?: number; reason?: string } => {
  if (amounts.length === 1) return { amount: parseAmount(amounts[0]) };

  const parsed = amounts.map(parseAmount);
  if (amounts.length >= 3) {
    const first = Math.abs(parsed[0]);
    const second = Math.abs(parsed[1]);
    const runningBalance = Math.abs(parsed[parsed.length - 1]);

    if (first === 0 && second > 0) return { amount: parsed[1], runningBalance };
    if (second === 0 && first > 0) return { amount: parsed[0], runningBalance };
    if (first > 0 && second > 0) {
      return {
        amount: parsed[0],
        runningBalance,
        reason: 'both debit and credit amount columns are non-zero; verify transaction direction',
      };
    }
    return { amount: 0, runningBalance, reason: 'transaction amount columns are zero or unclear' };
  }

  return {
    amount: parsed[0],
    runningBalance: Math.abs(parsed[amounts.length - 1]),
  };
};

const expandYear = (year: string): number => {
  if (year.length === 2) return 2000 + Number(year);
  return Number(year);
};

const parseStatementBounds = (statementPeriod?: string): { startMonth: number; startYear: number; endMonth: number; endYear: number } | undefined => {
  const matches = [...(statementPeriod || '').matchAll(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g)];
  if (matches.length < 2) return undefined;
  const startMonth = Number(matches[0][1]);
  const startYear = expandYear(matches[0][3]);
  const endMonth = Number(matches[1][1]);
  const endYear = expandYear(matches[1][3]);
  if (!startMonth || !endMonth || !startYear || !endYear) return undefined;
  return { startMonth, startYear, endMonth, endYear };
};

const inferYearForShortDate = (month: number, statementPeriod?: string): { year?: number; needsReview: boolean; reason?: string } => {
  const bounds = parseStatementBounds(statementPeriod);
  if (!bounds) return { needsReview: true, reason: 'Short date year could not be safely inferred' };
  if (bounds.startYear === bounds.endYear) return { year: bounds.startYear, needsReview: false };
  if (bounds.endYear === bounds.startYear + 1) {
    if (month >= bounds.startMonth) return { year: bounds.startYear, needsReview: false };
    if (month <= bounds.endMonth) return { year: bounds.endYear, needsReview: false };
  }
  return { needsReview: true, reason: 'Short date year could not be safely inferred' };
};

const normalizeTransactionDate = (rawDate: string, statementPeriod?: string): { date: string; inferredYear: boolean; needsReview: boolean; reason?: string } => {
  if (datedWithYearPattern.test(rawDate)) {
    const [rawMonth, rawDay, rawYear] = rawDate.split(/[\/-]/);
    const month = rawMonth.padStart(2, '0');
    const day = rawDay.padStart(2, '0');
    return { date: `${expandYear(rawYear)}-${month}-${day}`, inferredYear: false, needsReview: false };
  }
  if (!shortDatePattern.test(rawDate)) return { date: rawDate, inferredYear: false, needsReview: false };
  const [rawMonth, rawDay] = rawDate.split(/[\/-]/);
  const inferred = inferYearForShortDate(Number(rawMonth), statementPeriod);
  if (!inferred.year) {
    return { date: rawDate, inferredYear: false, needsReview: true, reason: inferred.reason || 'Short date year could not be safely inferred' };
  }
  const month = rawMonth.padStart(2, '0');
  const day = rawDay.padStart(2, '0');
  return { date: `${inferred.year}-${month}-${day}`, inferredYear: true, needsReview: false };
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
      const dateMatches = findTransactionDates(clean);
      const leadingDates = getLeadingDateColumns(clean);
      const dateMatch = leadingDates?.postedDate || dateMatches[0];
      const effectiveDate = leadingDates?.effectiveDate;
      const hasUnsafeDescriptionDate = Boolean(!effectiveDate && leadingDates?.hasDescriptionDate);
      const amountMatches = clean.match(moneyPattern) || [];
      if (!dateMatch || amountMatches.length === 0) return;

      const isBalanceLine = balanceWords.test(clean) && amountMatches.length <= 1;
      const inferredAmounts = inferAmountColumns(clean, amountMatches);
      const amount = inferredAmounts.amount;
      const runningBalance = inferredAmounts.runningBalance;
      let description = clean.replace(dateMatch, ' ');
      if (effectiveDate) description = description.replace(effectiveDate, ' ');
      amountMatches.forEach(amountText => { description = description.replace(amountText, ' '); });
      description = description.replace(/\s+/g, ' ').trim();

      const normalizedDate = normalizeTransactionDate(effectiveDate || dateMatch, context?.statementPeriod);
      const normalizedPostedDate = effectiveDate ? normalizeTransactionDate(dateMatch, context?.statementPeriod) : undefined;
      const direction = inferTransactionType(clean, amount, context);
      const reviewReasons: string[] = [];
      if (isBalanceLine) reviewReasons.push('balance line detected but not transaction');
      if (!description || description.length < 3) reviewReasons.push('merchant unclear');
      if (!dateMatch) reviewReasons.push('unclear date');
      if (normalizedDate.needsReview && normalizedDate.reason) reviewReasons.push(normalizedDate.reason);
      if (!Number.isFinite(amount) || amount === 0) reviewReasons.push('unclear amount');
      if (direction.reason) reviewReasons.push(direction.reason);
      if (inferredAmounts.reason) reviewReasons.push(inferredAmounts.reason);
      const note = hasUnsafeDescriptionDate ? 'Additional date found in description; verify transaction date' : undefined;

      const needsReview = reviewReasons.length > 0 || direction.type === 'unknown';
      candidates.push({
        id: `CAND-${documentId}-${pageIndex + 1}-${lineIndex + 1}`,
        documentId,
        transactionDate: normalizedDate.date,
        postedDate: normalizedPostedDate?.date,
        rawDescription: description || clean,
        cleanMerchantName: cleanMerchant(description),
        amount: Math.abs(amount),
        transactionType: direction.type,
        runningBalance,
        sourcePage: context?.sourcePagesApproximate ? undefined : pageIndex + 1,
        sourcePageApproximate: Boolean(context?.sourcePagesApproximate),
        sourceLine: lineIndex + 1,
        confidenceScore: needsReview ? 0.55 : effectiveDate ? 0.9 : 0.86,
        needsReview,
        reviewReason: reviewReasons.join('; ') || (normalizedDate.inferredYear ? 'year inferred from statement period' : undefined),
        note,
      });
    });
  });

  return candidates;
}
