export type LegalCandidateKind = 'allegation' | 'statement' | 'evidence_reference' | 'finding' | 'order' | 'user_note' | 'generated_interpretation';
export interface LegalCandidate { id: string; documentId: string; kind: LegalCandidateKind; field: string; value: string; sourcePage?: number; sourceExcerpt: string; confidence: number; verificationStatus: 'needs_review' | 'confirmed' | 'corrected' | 'excluded' | 'disputed'; }
export type LegalPageMapping = 'exact' | 'approximate' | 'none';

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
