export type LegalCandidateKind = 'allegation' | 'statement' | 'evidence_reference' | 'finding' | 'order' | 'user_note' | 'generated_interpretation';
export interface LegalCandidate { id: string; documentId: string; kind: LegalCandidateKind; field: string; value: string; sourcePage?: number; sourceExcerpt: string; confidence: number; verificationStatus: 'needs_review' | 'confirmed' | 'corrected' | 'excluded' | 'disputed'; }
export type LegalPageMapping = 'exact' | 'approximate' | 'none';

const LEGAL_CANDIDATE_KINDS = new Set<LegalCandidateKind>(['allegation', 'statement', 'evidence_reference', 'finding', 'order', 'user_note', 'generated_interpretation']);
const LEGAL_VERIFICATION_STATUSES = new Set<LegalCandidate['verificationStatus']>(['needs_review', 'confirmed', 'corrected', 'excluded', 'disputed']);
const LEGAL_CANDIDATE_KEYS = new Set(['id', 'documentId', 'kind', 'field', 'value', 'sourcePage', 'sourceExcerpt', 'confidence', 'verificationStatus']);
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasUnsafeKeys = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.keys(value).some(key => PROHIBITED_KEYS.has(key) || hasUnsafeKeys((value as Record<string, unknown>)[key], seen));
};

export function parseLegalCandidate(value: unknown): LegalCandidate | undefined {
  if (!isPlainObject(value) || hasUnsafeKeys(value) || Object.keys(value).some(key => !LEGAL_CANDIDATE_KEYS.has(key))) return undefined;
  if (typeof value.id !== 'string' || value.id.length === 0) return undefined;
  if (typeof value.documentId !== 'string' || value.documentId.length === 0) return undefined;
  if (typeof value.kind !== 'string' || !LEGAL_CANDIDATE_KINDS.has(value.kind as LegalCandidateKind)) return undefined;
  if (typeof value.field !== 'string' || value.field.length === 0) return undefined;
  if (typeof value.value !== 'string' || value.value.length === 0) return undefined;
  if (typeof value.sourceExcerpt !== 'string') return undefined;
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) return undefined;
  if (typeof value.verificationStatus !== 'string' || !LEGAL_VERIFICATION_STATUSES.has(value.verificationStatus as LegalCandidate['verificationStatus'])) return undefined;
  if (value.sourcePage !== undefined && (!Number.isSafeInteger(value.sourcePage) || (value.sourcePage as number) < 1)) return undefined;
  return value as unknown as LegalCandidate;
}

const patterns: Array<{ kind: LegalCandidateKind; field: string; expression: RegExp }> = [
  { kind: 'evidence_reference', field: 'case_number', expression: /\b(?:case|file)\s*(?:no\.?|number|#)\s*[:#]?\s*([A-Z0-9-]{4,})/i },
  { kind: 'order', field: 'ordered_obligation', expression: /\b(?:it is ordered|the court orders|shall|must)\b[^.]{1,500}/i },
  { kind: 'finding', field: 'finding', expression: /\b(?:the court finds|finding of fact|the court concludes)\b[^.]{1,500}/i },
  { kind: 'allegation', field: 'allegation', expression: /\b(?:alleges?|alleged|claims?|contends?)\b[^.]{1,500}/i },
  { kind: 'statement', field: 'statement', expression: /\b(?:testified|stated|declared)\b[^.]{1,500}/i },
  { kind: 'evidence_reference', field: 'exhibit_reference', expression: /\bexhibit\s+[A-Z0-9-]+\b/i },
];

export function extractLegalCandidates(documentId: string, pageTexts: string[], pageMapping: LegalPageMapping = 'exact'): LegalCandidate[] {
  const candidates: LegalCandidate[] = [];
  pageTexts.forEach((text, pageIndex) => patterns.forEach(pattern => {
    for (const match of text.matchAll(new RegExp(pattern.expression.source, `${pattern.expression.flags.includes('g') ? pattern.expression.flags : `${pattern.expression.flags}g`}`))) {
      const value = (match[1] || match[0]).trim();
      candidates.push({ id: `LEGAL-${documentId}-${pageIndex + 1}-${candidates.length + 1}`, documentId, kind: pattern.kind, field: pattern.field, value, ...(pageMapping === 'exact' ? { sourcePage: pageIndex + 1 } : {}), sourceExcerpt: match[0].trim(), confidence: 0.65, verificationStatus: 'needs_review' });
    }
  }));
  return candidates;
}
