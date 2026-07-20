import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { clearStoredFiles, getUploadedFile, saveUploadedFile } from '../fileStorage';
import { deleteExtractedText, getExtractedText, saveExtractedText } from '../extractedTextStorage';
import { exportProjectArchive, inspectProjectArchive, restoreProjectArchive } from '../projectArchive';
import { sha256 } from '../fileIntegrity';
import type { WorkspaceState } from '../persistence';

Object.assign(globalThis, { window: globalThis });
const workspace = (id: string): WorkspaceState => ({ accounts: [], rules: [], transactions: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina', documents: [{ id: `DOC-${id}`, filename: 'synthetic.txt', upload_timestamp: '2026-01-01T00:00:00.000Z', file_type: 'Other', ocr_status: 'not_started', ocr_confidence: 0, institution_name: 'Synthetic', processing_status: 'Requires Verification', source_file_status: 'stored', local_file: { storage: 'indexeddb', stored: true } }], profile: { userDisplayName: 'Synthetic User', workspaceName: id, jurisdiction: 'North Carolina', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z', appVersion: 'test' } });

describe('complete project archive lifecycle', () => {
  beforeEach(async () => { await clearStoredFiles(); await deleteExtractedText('DOC-ROUNDTRIP'); });

  it('exports, validates, and restores originals and extracted artifacts', async () => {
    const state = workspace('ROUNDTRIP');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['synthetic source'], 'synthetic.txt', { type: 'text/plain' }));
    await saveExtractedText({ documentId: 'DOC-ROUNDTRIP', text: 'synthetic extracted', pageTexts: ['synthetic extracted'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z', structuredData: { Sheet1: [['Header'], ['Value']] } });
    const archive = await exportProjectArchive('ROUNDTRIP', state);
    const inspected = await inspectProjectArchive(archive);
    expect(inspected.manifest.files).toHaveLength(1);
    await clearStoredFiles(); await deleteExtractedText('DOC-ROUNDTRIP');
    const restored = await restoreProjectArchive(archive);
    expect(restored.profile?.workspaceName).toBe('ROUNDTRIP');
    expect((await getUploadedFile('DOC-ROUNDTRIP'))?.blob).toBeTruthy();
    expect((await getExtractedText('DOC-ROUNDTRIP'))?.structuredData).toEqual({ Sheet1: [['Header'], ['Value']] });
  });

  it('rejects a checksum-corrupted archive', async () => {
    const state = workspace('ROUNDTRIP');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['synthetic source'], 'synthetic.txt', { type: 'text/plain' }));
    const archive = await exportProjectArchive('ROUNDTRIP', state);
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    const path = Object.keys(zip.files).find(name => name.startsWith('source-files/') && !name.endsWith('/') && !name.endsWith('metadata.json'))!;
    zip.file(path, 'tampered bytes');
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/Checksum verification failed/);
  });

  it('keeps project data scoped to the archived workspace', async () => {
    const first = workspace('ROUNDTRIP');
    const second = workspace('OTHER');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['first'], 'synthetic.txt'));
    await saveUploadedFile('DOC-OTHER', new File(['second'], 'other.txt'));
    await saveExtractedText({ documentId: 'DOC-OTHER', text: 'unrelated private project text', pageTexts: [], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    const inspected = await inspectProjectArchive(await exportProjectArchive('ROUNDTRIP', first));
    expect(inspected.workspace.documents.map(document => document.id)).toEqual(['DOC-ROUNDTRIP']);
    expect(inspected.manifest.files.map(file => file.documentId)).toEqual(['DOC-ROUNDTRIP']);
    expect(inspected.manifest.artifacts.some(artifact => artifact.path.includes('DOC-OTHER'))).toBe(false);
    expect(second.documents[0].id).toBe('DOC-OTHER');
    const restored = await restoreProjectArchive(await exportProjectArchive('ROUNDTRIP', first), { 'DOC-ROUNDTRIP': 'DOC-IMPORTED-COPY' });
    expect(restored.documents[0].id).toBe('DOC-IMPORTED-COPY');
    expect(await getUploadedFile('DOC-IMPORTED-COPY')).toBeTruthy();
  });

  it('preserves structured-data arrays without numeric-key object corruption', async () => {
    const state = workspace('ROUNDTRIP');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['source'], 'synthetic.txt'));
    const rows = [['Date', 'Description', 'Amount'], ['2026-01-01', 'Example Merchant', '-10.00'], ['2026-01-02', 'Example Refund', '5.00']];
    await saveExtractedText({ documentId: 'DOC-ROUNDTRIP', text: 'rows', pageTexts: ['rows'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z', structuredData: rows });
    const restored = await restoreProjectArchive(await exportProjectArchive('ROUNDTRIP', state), { 'DOC-ROUNDTRIP': 'DOC-ARRAY-COPY' });
    const structured = (await getExtractedText('DOC-ARRAY-COPY'))?.structuredData;
    expect(restored.documents[0].id).toBe('DOC-ARRAY-COPY');
    expect(Array.isArray(structured)).toBe(true);
    expect(structured).toEqual(rows);
  });

  it('remaps document IDs inside plain-object candidate collections', async () => {
    const state = workspace('ROUNDTRIP');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['source'], 'synthetic.txt'));
    await saveExtractedText({ documentId: 'DOC-ROUNDTRIP', text: 'candidate', pageTexts: ['candidate'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z', structuredData: { candidates: [{ documentId: 'DOC-ROUNDTRIP', row: 2 }], legalCandidates: [{ documentId: 'DOC-ROUNDTRIP', kind: 'allegation' }] } });
    await restoreProjectArchive(await exportProjectArchive('ROUNDTRIP', state), { 'DOC-ROUNDTRIP': 'DOC-OBJECT-COPY' });
    expect((await getExtractedText('DOC-OBJECT-COPY'))?.structuredData).toMatchObject({ candidates: [{ documentId: 'DOC-OBJECT-COPY' }], legalCandidates: [{ documentId: 'DOC-OBJECT-COPY' }] });
  });

  it.each([null, 'workspace', 42, [], {}, { documents: [], transactions: [] }, { ...workspace('BAD'), documents: {} }])('rejects malformed workspace JSON: %j', async malformed => {
    const zip = new JSZip();
    const workspaceJson = JSON.stringify(malformed);
    zip.file('workspace.json', workspaceJson);
    zip.file('manifest.json', JSON.stringify({ schemaVersion: 'nafa-archive-v1', createdAt: '2026-01-01T00:00:00.000Z', workspaceId: 'BAD', files: [], artifacts: [{ path: 'workspace.json', sha256: await sha256(new Blob([workspaceJson])), size: new Blob([workspaceJson]).size }] }));
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/workspace data is invalid/);
  });

  it('stops when a document claims retained source bytes that are missing', async () => {
    await expect(exportProjectArchive('MISSING', workspace('MISSING'))).rejects.toThrow(/claims a retained source file/);
  });

  it('round-trips 25 retained files and 1,000 structured rows without cross-project loading', async () => {
    const state = workspace('STRESS');
    state.documents = Array.from({ length: 25 }, (_, index) => ({ ...state.documents[0], id: `DOC-STRESS-${index + 1}`, filename: `synthetic-${index + 1}.txt` }));
    const rows = Array.from({ length: 1_000 }, (_, index) => [`2026-07-${String((index % 28) + 1).padStart(2, '0')}`, `Synthetic Row ${index + 1}`, String(index + 0.25)]);
    for (const document of state.documents) await saveUploadedFile(document.id, new File([`synthetic retained bytes ${document.id}`], document.filename));
    await saveExtractedText({ documentId: state.documents[0].id, text: '1,000 synthetic rows', pageTexts: [], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z', structuredData: rows });
    await saveUploadedFile('DOC-UNRELATED-STRESS', new File(['must not be exported'], 'unrelated.txt'));
    const archive = await exportProjectArchive('STRESS', state);
    const inspected = await inspectProjectArchive(archive);
    expect(inspected.manifest.files).toHaveLength(25);
    expect(inspected.manifest.files.some(item => item.documentId === 'DOC-UNRELATED-STRESS')).toBe(false);
    await restoreProjectArchive(archive, { 'DOC-STRESS-1': 'DOC-STRESS-RESTORED' });
    const restoredRows = (await getExtractedText('DOC-STRESS-RESTORED'))?.structuredData;
    expect(Array.isArray(restoredRows)).toBe(true);
    expect(restoredRows).toHaveLength(1_000);
    expect(archive.size).toBeGreaterThan(1_000);
  });
});
