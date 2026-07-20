import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { clearStoredFiles, getUploadedFile, saveUploadedFile } from '../fileStorage';
import { deleteExtractedText, getExtractedText, saveExtractedText } from '../extractedTextStorage';
import { exportProjectArchive, inspectProjectArchive, restoreProjectArchive } from '../projectArchive';
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
    const inspected = await inspectProjectArchive(await exportProjectArchive('ROUNDTRIP', first));
    expect(inspected.workspace.documents.map(document => document.id)).toEqual(['DOC-ROUNDTRIP']);
    expect(inspected.manifest.files.map(file => file.documentId)).toEqual(['DOC-ROUNDTRIP']);
    expect(second.documents[0].id).toBe('DOC-OTHER');
    const restored = await restoreProjectArchive(await exportProjectArchive('ROUNDTRIP', first), { 'DOC-ROUNDTRIP': 'DOC-IMPORTED-COPY' });
    expect(restored.documents[0].id).toBe('DOC-IMPORTED-COPY');
    expect(await getUploadedFile('DOC-IMPORTED-COPY')).toBeTruthy();
  });
});
