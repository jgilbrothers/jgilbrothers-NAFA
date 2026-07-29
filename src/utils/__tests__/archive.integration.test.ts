import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { clearStoredFiles, getUploadedFile, saveUploadedFile } from '../fileStorage';
import { deleteExtractedText, getExtractedText, saveExtractedText } from '../extractedTextStorage';
import { ARCHIVE_LIMITS, ARCHIVE_SCHEMA_VERSION, exportProjectArchive, inspectProjectArchive, restoreProjectArchive, validateArchiveManifest, type ArchiveExportStorage, type ArchiveManifest, type ArchiveRestoreStorage } from '../projectArchive';
import { sha256 } from '../fileIntegrity';
import type { WorkspaceState } from '../persistence';

Object.assign(globalThis, { window: globalThis });
const workspace = (id: string): WorkspaceState => ({ accounts: [], rules: [], transactions: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina', documents: [{ id: `DOC-${id}`, filename: 'synthetic.txt', upload_timestamp: '2026-01-01T00:00:00.000Z', file_type: 'Other', ocr_status: 'not_started', ocr_confidence: 0, institution_name: 'Synthetic', processing_status: 'Requires Verification', source_file_status: 'stored', local_file: { storage: 'indexeddb', stored: true } }], profile: { userDisplayName: 'Synthetic User', workspaceName: id, jurisdiction: 'North Carolina', createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z', appVersion: 'test' } });
const validationMemoryStorage = () => {
  const files = new Map<string, any>();
  const texts = new Map<string, any>();
  const storage: ArchiveRestoreStorage = {
    getFile: async id => files.get(id),
    getText: async id => texts.get(id),
    putFile: async record => { files.set(record.documentId, record); },
    putText: async record => { texts.set(record.documentId, record); },
    deleteFile: async id => { files.delete(id); },
    deleteText: async id => { texts.delete(id); },
  };
  return { files, texts, storage };
};

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

  it('enforces complete-export claims symmetrically for source files and extracted text', async () => {
    const state = workspace('COMPLETE-CLAIMS');
    state.documents[0].extracted_text_available = true;
    state.documents[0].extracted_text_id = state.documents[0].id;
    const source = { documentId: state.documents[0].id, originalFileName: 'synthetic.txt', mimeType: 'text/plain', size: 6, uploadedAt: '2026-01-01T00:00:00.000Z', blob: new Blob(['source'], { type: 'text/plain' }) };
    const text = { documentId: state.documents[0].id, text: 'extracted', pageTexts: ['extracted'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
    const complete: ArchiveExportStorage = { getFile: async () => source, getText: async () => text };
    const inspected = await inspectProjectArchive(await exportProjectArchive('COMPLETE-CLAIMS', state, undefined, complete));
    expect(inspected.manifest.files).toHaveLength(1);
    expect(inspected.manifest.artifacts.some(item => item.path === `extracted-text/${state.documents[0].id}.json`)).toBe(true);

    await expect(exportProjectArchive('SOURCE-READ-FAIL', state, undefined, { ...complete, getFile: async () => { throw new Error('synthetic source read rejection'); } })).rejects.toThrow(/source file.*could not be read/i);
    await expect(exportProjectArchive('TEXT-READ-FAIL', state, undefined, { ...complete, getText: async () => { throw new Error('synthetic text read rejection'); } })).rejects.toThrow(/extracted text.*could not be read/i);
    await expect(exportProjectArchive('SOURCE-MISSING', state, undefined, { ...complete, getFile: async () => undefined })).rejects.toThrow(/claims a retained source file.*missing/i);
    await expect(exportProjectArchive('TEXT-MISSING', state, undefined, { ...complete, getText: async () => undefined })).rejects.toThrow(/claims extracted text.*missing/i);
    await expect(exportProjectArchive('TEXT-MALFORMED', state, undefined, { ...complete, getText: async () => ({ ...text, pageTexts: [7] } as any) })).rejects.toThrow(/extracted text is invalid/i);

    const unavailable = workspace('EXPLICITLY-UNAVAILABLE');
    unavailable.documents[0] = { ...unavailable.documents[0], source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false }, extracted_text_available: false, extracted_text_id: undefined };
    await expect(exportProjectArchive('EXPLICITLY-UNAVAILABLE', unavailable, undefined, {
      getFile: async () => { throw new Error('unavailable source storage'); },
      getText: async () => { throw new Error('unavailable text storage'); },
    })).resolves.toBeInstanceOf(Blob);
  });

  it('round-trips an account with an empty optional institution name while keeping required fields strict', async () => {
    const state = workspace('EMPTY-INSTITUTION');
    state.accounts = [{
      id: 'ACC-EMPTY-INSTITUTION',
      account_name: 'Synthetic Account',
      account_suffix: '0000',
      account_type: 'checking',
      institution_name: '',
      current_balance: 0,
      available_balance: 0,
      statement_period: 'Current Account Period',
      account_status: 'Active',
    }];
    await saveUploadedFile('DOC-EMPTY-INSTITUTION', new File(['synthetic source'], 'synthetic.txt', { type: 'text/plain' }));
    const archive = await exportProjectArchive('EMPTY-INSTITUTION', state);
    await clearStoredFiles();
    expect((await restoreProjectArchive(archive)).accounts[0].institution_name).toBe('');

    const malformed = await rewriteArchive(archive, async (zip, manifest) => {
      const parsed = JSON.parse(await zip.file('workspace.json')!.async('text'));
      parsed.accounts[0].account_name = '';
      await replaceArtifact(zip, manifest, 'workspace.json', JSON.stringify(parsed));
    });
    await expect(inspectProjectArchive(malformed)).rejects.toThrow(/account_name must be a non-empty string/);
  });

  it('round-trips supported empty document and account institution names', async () => {
    const state = workspace('EMPTY-DISPLAY-FIELDS');
    state.documents[0] = { ...state.documents[0], institution_name: '', source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
    state.accounts = [{
      id: 'ACC-EMPTY', account_name: 'Synthetic', account_suffix: '0000', account_type: 'checking',
      institution_name: '', current_balance: 0, available_balance: 0, statement_period: 'Current', account_status: 'Active',
    }];
    const restored = await restoreProjectArchive(await exportProjectArchive('EMPTY-DISPLAY-FIELDS', state));
    expect(restored.documents[0].institution_name).toBe('');
    expect(restored.accounts[0].institution_name).toBe('');
    await expect(exportProjectArchive('EMPTY-ID', { ...state, documents: [{ ...state.documents[0], id: '' }] })).rejects.toThrow(/documents\[0\]\.id must be a non-empty string/);
    await expect(exportProjectArchive('EMPTY-FILENAME', { ...state, documents: [{ ...state.documents[0], filename: '' }] })).rejects.toThrow(/filename must be a non-empty string/);
  });

  it('exports and imports the advertised maximum documents with source and text artifacts', async () => {
    const state = workspace('MAXIMUM');
    state.documents = Array.from({ length: ARCHIVE_LIMITS.maxDocuments }, (_, index) => ({
      ...state.documents[0],
      id: `DOC-MAX-${index + 1}`,
      filename: `source-${index + 1}.txt`,
      extracted_text_available: true,
      extracted_text_id: `DOC-MAX-${index + 1}`,
    }));
    const storage: ArchiveExportStorage = {
      getFile: async documentId => {
        const contents = `source-${documentId}`;
        return { documentId, originalFileName: `${documentId}.txt`, mimeType: 'text/plain', size: new Blob([contents]).size, uploadedAt: '2026-01-01T00:00:00.000Z', blob: new Blob([contents], { type: 'text/plain' }) };
      },
      getText: async documentId => ({ documentId, text: `text-${documentId}`, pageTexts: [`text-${documentId}`], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }),
    };
    state.documents.forEach(document => { document.filename = `${document.id}.txt`; });
    const archive = await exportProjectArchive('MAXIMUM', state, undefined, storage);
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    expect(Object.values(zip.files).filter(entry => !entry.dir)).toHaveLength((ARCHIVE_LIMITS.maxDocuments * 3) + 2);
    const memory = validationMemoryStorage();
    const restored = await restoreProjectArchive(archive, {}, memory.storage);
    expect(restored.documents).toHaveLength(ARCHIVE_LIMITS.maxDocuments);
    expect(memory.files.size).toBe(ARCHIVE_LIMITS.maxDocuments);
    expect(memory.texts.size).toBe(ARCHIVE_LIMITS.maxDocuments);

    const excessive = { ...state, documents: [...state.documents, { ...state.documents[0], id: 'DOC-MAX-EXCESS', filename: 'excess.txt', extracted_text_id: 'DOC-MAX-EXCESS' }] };
    await expect(exportProjectArchive('MAXIMUM-EXCESS', excessive, undefined, storage)).rejects.toThrow(/more than 500 documents/);
  }, 30_000);

  it('round-trips reserved and encoded source filenames without artifact collisions', async () => {
    const names = ['metadata.json', 'workspace.json', 'manifest.json', 'encoded name #%.json'];
    const state = workspace('RESERVED');
    state.documents = names.map((filename, index) => ({ ...state.documents[0], id: `DOC-RESERVED-${index + 1}`, filename }));
    for (const document of state.documents) await saveUploadedFile(document.id, new File([`source ${document.id}`], document.filename, { type: 'application/json' }));

    const archive = await exportProjectArchive('RESERVED', state);
    const inspected = await inspectProjectArchive(archive);
    expect(inspected.manifest.files.every(file => file.path.includes('/content/'))).toBe(true);
    expect(new Set([...inspected.manifest.files.map(file => file.path), ...inspected.manifest.artifacts.map(artifact => artifact.path)]).size).toBe(inspected.manifest.files.length + inspected.manifest.artifacts.length);
    await clearStoredFiles();
    await restoreProjectArchive(archive);
    for (const document of state.documents) expect((await getUploadedFile(document.id))?.originalFileName).toBe(document.filename);
  });

  it('rejects a checksum-corrupted archive', async () => {
    const state = workspace('ROUNDTRIP');
    await saveUploadedFile('DOC-ROUNDTRIP', new File(['synthetic source'], 'synthetic.txt', { type: 'text/plain' }));
    const archive = await exportProjectArchive('ROUNDTRIP', state);
    const zip = await JSZip.loadAsync(await archive.arrayBuffer());
    const path = Object.keys(zip.files).find(name => name.startsWith('source-files/') && !name.endsWith('/') && !name.endsWith('metadata.json'))!;
    zip.file(path, 'tampered bytes');
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/(?:Checksum|size) verification failed/);
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
    zip.file('manifest.json', JSON.stringify({ schemaVersion: ARCHIVE_SCHEMA_VERSION, createdAt: '2026-01-01T00:00:00.000Z', workspaceId: 'BAD', files: [], artifacts: [{ path: 'workspace.json', sha256: await sha256(new Blob([workspaceJson])), size: new Blob([workspaceJson]).size }] }));
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/workspace data is invalid/);
  });

  it.each([
    ['document filename', (state: any) => { delete state.documents[0].filename; }],
    ['document file_type', (state: any) => { delete state.documents[0].file_type; }],
    ['document institution_name', (state: any) => { delete state.documents[0].institution_name; }],
    ['account member', (state: any) => { state.accounts = [{ id: 'ACC-BAD' }]; }],
    ['transaction member', (state: any) => { state.transactions = [{ transaction_id: 'TX-BAD' }]; }],
    ['rule member', (state: any) => { state.rules = [{ id: 'RULE-BAD' }]; }],
    ['reconciliation member', (state: any) => { state.reconItems = [{ id: 'REC-BAD' }]; }],
    ['audit member', (state: any) => { state.auditLogs = [{ id: 'LOG-BAD' }]; }],
    ['chat member', (state: any) => { state.chatLog = [{ id: 'CHAT-BAD' }]; }],
  ])('rejects malformed %s before persistence', async (_label, mutate) => {
    const state = workspace('MEMBER');
    state.documents[0] = { ...state.documents[0], source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
    const archive = await exportProjectArchive('MEMBER', state);
    const malformed = await rewriteArchive(archive, async (zip, manifest) => {
      const parsed = JSON.parse(await zip.file('workspace.json')!.async('text'));
      mutate(parsed);
      await replaceArtifact(zip, manifest, 'workspace.json', JSON.stringify(parsed));
    });
    const memory = validationMemoryStorage();
    await expect(restoreProjectArchive(malformed, {}, memory.storage)).rejects.toThrow(/Archive workspace data is invalid/);
    expect(memory.files.size).toBe(0);
    expect(memory.texts.size).toBe(0);
  });

  it('stops when a document claims retained source bytes that are missing', async () => {
    await expect(exportProjectArchive('MISSING', workspace('MISSING'))).rejects.toThrow(/claims a retained source file/);
  });

  it('exports and restores checksum-verified extracted text without a source blob', async () => {
    const state = workspace('TEXT-ONLY');
    state.documents[0] = { ...state.documents[0], source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
    await saveExtractedText({ documentId: 'DOC-TEXT-ONLY', text: 'synthetic retained text', pageTexts: ['synthetic retained text'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    const archive = await exportProjectArchive('TEXT-ONLY', state);
    const inspected = await inspectProjectArchive(archive);
    expect(inspected.manifest.files).toEqual([]);
    expect(inspected.manifest.artifacts.some(item => item.path === 'extracted-text/DOC-TEXT-ONLY.json')).toBe(true);
    await deleteExtractedText('DOC-TEXT-ONLY');
    const restored = await restoreProjectArchive(archive, { 'DOC-TEXT-ONLY': 'DOC-TEXT-ONLY-RESTORED' });
    expect(restored.documents[0]).toMatchObject({ id: 'DOC-TEXT-ONLY-RESTORED', source_file_status: 'unavailable', local_file: { stored: false } });
    expect((await getExtractedText('DOC-TEXT-ONLY-RESTORED'))?.text).toBe('synthetic retained text');
  });

  it('round-trips a mixed stored, text-only, and unavailable project honestly', async () => {
    const state = workspace('MIX-STORED');
    state.documents = [
      state.documents[0],
      { ...state.documents[0], id: 'DOC-MIX-TEXT', filename: 'text-only.txt', source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } },
      { ...state.documents[0], id: 'DOC-MIX-NONE', filename: 'unavailable.txt', source_file_status: 'metadata_only', local_file: { storage: 'indexeddb', stored: false } },
    ];
    await saveUploadedFile('DOC-MIX-STORED', new File(['stored synthetic'], 'synthetic.txt', { type: 'text/plain' }));
    await saveExtractedText({ documentId: 'DOC-MIX-TEXT', text: 'text survives', pageTexts: ['text survives'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    const archive = await exportProjectArchive('MIXED', state);
    const inspected = await inspectProjectArchive(archive);
    expect(inspected.manifest.files.map(item => item.documentId)).toEqual(['DOC-MIX-STORED']);
    await clearStoredFiles();
    await deleteExtractedText('DOC-MIX-TEXT');
    const restored = await restoreProjectArchive(archive, { 'DOC-MIX-STORED': 'DOC-MIX-STORED-R', 'DOC-MIX-TEXT': 'DOC-MIX-TEXT-R', 'DOC-MIX-NONE': 'DOC-MIX-NONE-R' });
    expect(restored.documents.map(item => [item.id, item.source_file_status, item.local_file?.stored])).toEqual([
      ['DOC-MIX-STORED-R', 'stored', true],
      ['DOC-MIX-TEXT-R', 'unavailable', false],
      ['DOC-MIX-NONE-R', 'metadata_only', false],
    ]);
    expect((await getExtractedText('DOC-MIX-TEXT-R'))?.text).toBe('text survives');
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
    await clearStoredFiles();
    await deleteExtractedText(state.documents[0].id);
    await restoreProjectArchive(archive, { 'DOC-STRESS-1': 'DOC-STRESS-RESTORED' });
    const restoredRows = (await getExtractedText('DOC-STRESS-RESTORED'))?.structuredData;
    expect(Array.isArray(restoredRows)).toBe(true);
    expect(restoredRows).toHaveLength(1_000);
    expect(archive.size).toBeGreaterThan(1_000);
  });
});

const digest = 'a'.repeat(64);
const validManifest = (): ArchiveManifest => ({
  schemaVersion: ARCHIVE_SCHEMA_VERSION,
  createdAt: '2026-01-01T00:00:00.000Z',
  workspaceId: 'SYNTHETIC',
  files: [],
  artifacts: [{ path: 'workspace.json', sha256: digest, size: 1 }],
});

describe('archive manifest runtime validation', () => {
  it.each([null, [], 'manifest', 7, true])('rejects a non-object manifest root: %j', value => {
    expect(() => validateArchiveManifest(value)).toThrow(/Archive manifest is invalid/);
  });

  it.each([
    ['missing files', { ...validManifest(), files: undefined }],
    ['missing artifacts', { ...validManifest(), artifacts: undefined }],
    ['malformed file', { ...validManifest(), files: ['bad'] }],
    ['malformed artifact', { ...validManifest(), artifacts: ['bad'] }],
    ['invalid sha256', { ...validManifest(), artifacts: [{ path: 'workspace.json', sha256: 'nope', size: 1 }] }],
    ['negative size', { ...validManifest(), artifacts: [{ path: 'workspace.json', sha256: digest, size: -1 }] }],
    ['unsupported schema', { ...validManifest(), schemaVersion: 'nafa-archive-v999' }],
    ['legacy unprotected schema', { ...validManifest(), schemaVersion: 'nafa-archive-v1' }],
  ])('rejects %s', (_name, value) => expect(() => validateArchiveManifest(value)).toThrow(/Archive manifest is invalid/));

  it.each(['../workspace.json', '/workspace.json', 'C:\\workspace.json', 'folder\\..\\workspace.json', 'folder//workspace.json'])('rejects unsafe path %s', path => {
    expect(() => validateArchiveManifest({ ...validManifest(), artifacts: [{ path, sha256: digest, size: 1 }] })).toThrow(/Archive manifest is invalid/);
  });

  it('rejects duplicate paths and duplicate document IDs', () => {
    expect(() => validateArchiveManifest({ ...validManifest(), artifacts: [validManifest().artifacts[0], validManifest().artifacts[0]] })).toThrow(/duplicate archive path/);
    const metadata = { path: 'source-files/DOC-1/metadata.json', sha256: digest, size: 1 };
    expect(() => validateArchiveManifest({ ...validManifest(), files: [
      { path: 'source-files/DOC-1/a.txt', documentId: 'DOC-1', sha256: digest, size: 1 },
      { path: 'source-files/DOC-2/b.txt', documentId: 'DOC-1', sha256: digest, size: 1 },
    ], artifacts: [...validManifest().artifacts, metadata] })).toThrow(/duplicate documentId/);
  });

  it('allows text-only artifact IDs but rejects metadata without a retained source entry', () => {
    expect(validateArchiveManifest({ ...validManifest(), artifacts: [...validManifest().artifacts, { path: 'extracted-text/DOC-TEXT.json', sha256: digest, size: 1 }] }).artifacts).toHaveLength(2);
    expect(() => validateArchiveManifest({ ...validManifest(), artifacts: [...validManifest().artifacts, { path: 'source-files/DOC-NO-FILE/metadata.json', sha256: digest, size: 1 }] })).toThrow(/metadata artifact has no retained source file/);
  });

  it('enforces documented count and declared-size limits while accepting values below them', () => {
    const tooMany = Array.from({ length: ARCHIVE_LIMITS.maxDocuments + 1 }, (_, index) => ({ path: `source-files/D${index}/a`, documentId: `D${index}`, sha256: digest, size: 1 }));
    expect(() => validateArchiveManifest({ ...validManifest(), files: tooMany })).toThrow(/document limit/);
    expect(() => validateArchiveManifest({ ...validManifest(), artifacts: [{ path: 'workspace.json', sha256: digest, size: ARCHIVE_LIMITS.maxWorkspaceBytes + 1 }] })).toThrow(/size exceeds/);
    expect(validateArchiveManifest(validManifest())).toEqual(validManifest());
  });

  it('enforces source, metadata, and extracted-text size limits', () => {
    const file = { path: 'source-files/DOC-1/source.bin', documentId: 'DOC-1', sha256: digest, size: 1 };
    const metadata = { path: 'source-files/DOC-1/metadata.json', sha256: digest, size: 1 };
    expect(() => validateArchiveManifest({ ...validManifest(), files: [{ ...file, size: ARCHIVE_LIMITS.maxSourceFileBytes + 1 }], artifacts: [...validManifest().artifacts, metadata] })).toThrow(/size exceeds/);
    expect(() => validateArchiveManifest({ ...validManifest(), files: [file], artifacts: [...validManifest().artifacts, { ...metadata, size: ARCHIVE_LIMITS.maxMetadataBytes + 1 }] })).toThrow(/size exceeds/);
    expect(() => validateArchiveManifest({ ...validManifest(), files: [file], artifacts: [...validManifest().artifacts, metadata, { path: 'extracted-text/DOC-1.json', sha256: digest, size: ARCHIVE_LIMITS.maxExtractedTextBytes + 1 }] })).toThrow(/size exceeds/);
  });

  it('rejects prototype-pollution keys in the manifest', () => {
    const polluted = JSON.parse(`{"schemaVersion":"${ARCHIVE_SCHEMA_VERSION}","createdAt":"2026-01-01","workspaceId":"SYNTHETIC","files":[],"artifacts":[{"path":"workspace.json","sha256":"${digest}","size":1}],"__proto__":{"polluted":true}}`);
    expect(() => validateArchiveManifest(polluted)).toThrow(/prohibited key/);
  });
});

async function rewriteArchive(archive: Blob, mutate: (zip: JSZip, manifest: ArchiveManifest) => Promise<void> | void): Promise<Blob> {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('text')) as ArchiveManifest;
  await mutate(zip, manifest);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

const replaceArtifact = async (zip: JSZip, manifest: ArchiveManifest, path: string, contents: string) => {
  zip.file(path, contents);
  const artifact = manifest.artifacts.find(item => item.path === path)!;
  artifact.size = new Blob([contents]).size;
  artifact.sha256 = await sha256(new Blob([contents]));
};

describe('metadata integrity and validation', () => {
  beforeEach(async () => { await clearStoredFiles(); await deleteExtractedText('DOC-META'); });

  const metadataArchive = async () => {
    const state = workspace('META');
    await saveUploadedFile('DOC-META', new File(['synthetic metadata source'], 'synthetic-evidence.txt', { type: 'text/plain' }));
    return exportProjectArchive('META', state);
  };

  it.each([
    ['filename', (metadata: any) => { metadata.originalFileName = 'changed.txt'; }],
    ['MIME type', (metadata: any) => { metadata.mimeType = 'application/x-changed'; }],
  ])('rejects checksum-tampered metadata %s', async (_label, edit) => {
    const archive = await metadataArchive();
    const tampered = await rewriteArchive(archive, async (zip, manifest) => {
      const path = 'source-files/DOC-META/metadata.json';
      const metadata = JSON.parse(await zip.file(path)!.async('text'));
      edit(metadata);
      zip.file(path, JSON.stringify(metadata));
      // Deliberately leave the signed manifest digest unchanged.
      expect(manifest.artifacts.some(item => item.path === path)).toBe(true);
    });
    await expect(restoreProjectArchive(tampered, { 'DOC-META': `DOC-META-${_label}` })).rejects.toThrow(/(?:Checksum|size) verification failed/);
  });

  it('rejects missing, malformed, and disagreeing metadata before writes', async () => {
    const archive = await metadataArchive();
    const missing = await rewriteArchive(archive, (zip) => { zip.remove('source-files/DOC-META/metadata.json'); });
    await expect(restoreProjectArchive(missing, { 'DOC-META': 'DOC-META-MISSING' })).rejects.toThrow(/required entry is missing/);

    const malformed = await rewriteArchive(archive, async (zip, manifest) => replaceArtifact(zip, manifest, 'source-files/DOC-META/metadata.json', '{bad json'));
    await expect(restoreProjectArchive(malformed, { 'DOC-META': 'DOC-META-MALFORMED' })).rejects.toThrow(/metadata JSON is malformed/);

    const mismatch = await rewriteArchive(archive, async (zip, manifest) => {
      const path = 'source-files/DOC-META/metadata.json';
      const metadata = JSON.parse(await zip.file(path)!.async('text'));
      metadata.documentId = 'DOC-OTHER';
      await replaceArtifact(zip, manifest, path, JSON.stringify(metadata));
    });
    await expect(restoreProjectArchive(mismatch, { 'DOC-META': 'DOC-META-MISMATCH' })).rejects.toThrow(/document ID disagreement/);
    expect(await getUploadedFile('DOC-META-MISSING')).toBeUndefined();
    expect(await getUploadedFile('DOC-META-MALFORMED')).toBeUndefined();
    expect(await getUploadedFile('DOC-META-MISMATCH')).toBeUndefined();
  });

  it('restores valid verified metadata exactly', async () => {
    const archive = await metadataArchive();
    await restoreProjectArchive(archive, { 'DOC-META': 'DOC-META-VALID' });
    expect(await getUploadedFile('DOC-META-VALID')).toMatchObject({ documentId: 'DOC-META-VALID', originalFileName: 'synthetic-evidence.txt', mimeType: 'text/plain', size: 25 });
  });

  it('accepts matching or absent workspace digests and rejects contradictions before writes', async () => {
    const source = new File(['synthetic digest source'], 'digest.txt', { type: 'text/plain' });
    const actualDigest = await sha256(source);

    const matching = workspace('DIGEST-MATCH');
    matching.documents[0].sha256 = actualDigest;
    matching.documents[0].checksum_status = 'verified';
    await saveUploadedFile('DOC-DIGEST-MATCH', source);
    const matchingMemory = validationMemoryStorage();
    await restoreProjectArchive(await exportProjectArchive('DIGEST-MATCH', matching), {}, matchingMemory.storage);
    expect(matchingMemory.files.size).toBe(1);

    const absent = workspace('DIGEST-ABSENT');
    await saveUploadedFile('DOC-DIGEST-ABSENT', source);
    const absentMemory = validationMemoryStorage();
    await restoreProjectArchive(await exportProjectArchive('DIGEST-ABSENT', absent), {}, absentMemory.storage);
    expect(absentMemory.files.size).toBe(1);

    const contradictory = workspace('DIGEST-MISMATCH');
    contradictory.documents[0].sha256 = 'f'.repeat(64);
    contradictory.documents[0].checksum_status = 'verified';
    await saveUploadedFile('DOC-DIGEST-MISMATCH', source);
    const mismatchMemory = validationMemoryStorage();
    await expect(restoreProjectArchive(await exportProjectArchive('DIGEST-MISMATCH', contradictory), {}, mismatchMemory.storage)).rejects.toThrow(/workspace source checksum disagrees/);
    expect(mismatchMemory.files.size).toBe(0);
    expect(mismatchMemory.texts.size).toBe(0);
  });

  it('rejects an unreasonable compression ratio before parsing metadata', async () => {
    const archive = await metadataArchive();
    const compressed = await rewriteArchive(archive, async (zip, manifest) => {
      const path = 'source-files/DOC-META/metadata.json';
      const metadata = JSON.parse(await zip.file(path)!.async('text'));
      metadata.padding = 'A'.repeat(60_000);
      await replaceArtifact(zip, manifest, path, JSON.stringify(metadata));
    });
    await expect(inspectProjectArchive(compressed)).rejects.toThrow(/compression ratio/);
  });
});

describe('archive-wide trust boundaries', () => {
  it('rejects extracted text and source files for unknown workspace documents', async () => {
    const empty = { ...workspace('UNKNOWN'), documents: [] };
    const workspaceJson = JSON.stringify(empty);
    const extracted = JSON.stringify({ documentId: 'DOC-UNKNOWN', text: 'synthetic', pageTexts: ['synthetic'], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    const zip = new JSZip();
    zip.file('workspace.json', workspaceJson);
    zip.file('extracted-text/DOC-UNKNOWN.json', extracted);
    zip.file('manifest.json', JSON.stringify({ ...validManifest(), artifacts: [
      { path: 'workspace.json', sha256: await sha256(new Blob([workspaceJson])), size: new Blob([workspaceJson]).size },
      { path: 'extracted-text/DOC-UNKNOWN.json', sha256: await sha256(new Blob([extracted])), size: new Blob([extracted]).size },
    ] }));
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/unknown document ID DOC-UNKNOWN/);

    const state = workspace('SOURCE-UNKNOWN');
    await saveUploadedFile('DOC-SOURCE-UNKNOWN', new File(['source'], 'synthetic.txt'));
    const sourceArchive = await exportProjectArchive('SOURCE-UNKNOWN', state);
    const unknownSource = await rewriteArchive(sourceArchive, async (archiveZip, manifest) => {
      const text = JSON.stringify({ ...state, documents: [] });
      await replaceArtifact(archiveZip, manifest, 'workspace.json', text);
    });
    await expect(inspectProjectArchive(unknownSource)).rejects.toThrow(/unknown document ID DOC-SOURCE-UNKNOWN/);
  });

  it('migrates archive-restored legacy transactions without changing ledger facts', async () => {
    const state = workspace('LEGACY-TX');
    state.documents[0] = { ...state.documents[0], source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
    state.transactions = [{ transaction_id: 'LEGACY-1', transaction_date: '2026-01-02', raw_description: 'Synthetic Legacy', clean_vendor_name: 'Synthetic Legacy', amount: 17, transaction_type: 'debit', processing_method: 'Other', card_or_account_suffix: '0000', category: 'Groceries', is_pending: false }];
    const restored = await restoreProjectArchive(await exportProjectArchive('LEGACY-TX', state));
    expect(restored.transactions[0]).toEqual({ ...state.transactions[0], verification_status: 'confirmed' });
  });

  it('rejects a declared decompressed total above the browser safety limit', async () => {
    const zip = new JSZip();
    zip.file('workspace.json', '{}');
    const files = Array.from({ length: 81 }, (_, index) => ({ path: `source-files/DOC-${index}/source.bin`, documentId: `DOC-${index}`, sha256: digest, size: 0 }));
    const artifacts = [
      { path: 'workspace.json', sha256: digest, size: 2 },
      ...files.flatMap(file => [
        { path: `source-files/${file.documentId}/metadata.json`, sha256: digest, size: 1 },
        { path: `extracted-text/${file.documentId}.json`, sha256: digest, size: ARCHIVE_LIMITS.maxExtractedTextBytes },
      ]),
    ];
    zip.file('manifest.json', JSON.stringify({ schemaVersion: ARCHIVE_SCHEMA_VERSION, createdAt: '2026-01-01', workspaceId: 'LIMIT', files, artifacts }));
    await expect(inspectProjectArchive(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/decompressed-size limit/);
  });

  it('rejects unexpected ZIP entries and prototype-polluted workspace JSON', async () => {
    const state = workspace('TRUST');
    await saveUploadedFile('DOC-TRUST', new File(['trust'], 'trust.txt'));
    const archive = await exportProjectArchive('TRUST', state);
    const unexpected = await rewriteArchive(archive, zip => { zip.file('unexpected/private.tmp', 'synthetic'); });
    await expect(inspectProjectArchive(unexpected)).rejects.toThrow(/unexpected entry/);
    const polluted = await rewriteArchive(archive, async (zip, manifest) => {
      const parsed = JSON.parse(await zip.file('workspace.json')!.async('text'));
      const text = JSON.stringify(parsed).replace(/^{/, '{"__proto__":{"polluted":true},');
      await replaceArtifact(zip, manifest, 'workspace.json', text);
    });
    await expect(inspectProjectArchive(polluted)).rejects.toThrow(/prohibited key/);
  });

  it('counts user-data ZIP entries separately from directory bookkeeping entries', async () => {
    const state = workspace('DIRECTORIES');
    state.documents[0] = { ...state.documents[0], source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
    const archive = await exportProjectArchive('DIRECTORIES', state);
    const withDirectories = await rewriteArchive(archive, zip => {
      for (let index = 0; index < ARCHIVE_LIMITS.maxDocuments * 2; index += 1) zip.folder(`directory-${index}`);
    });
    await expect(inspectProjectArchive(withDirectories)).resolves.toMatchObject({ workspace: { documents: expect.any(Array) } });

    const excessive = new JSZip();
    for (let index = 0; index < ARCHIVE_LIMITS.maxEntries + 2; index += 1) excessive.file(`entry-${index}.txt`, '');
    await expect(inspectProjectArchive(await excessive.generateAsync({ type: 'blob' }))).rejects.toThrow(/non-directory ZIP entries/);
  });

  it('rejects an inconsistent ZIP entry table that can indicate duplicate decoded names', async () => {
    const state = workspace('ZIP-TABLE');
    await saveUploadedFile('DOC-ZIP-TABLE', new File(['zip table'], 'zip-table.txt'));
    const archive = await exportProjectArchive('ZIP-TABLE', state);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer);
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        view.setUint16(offset + 8, view.getUint16(offset + 8, true) + 1, true);
        view.setUint16(offset + 10, view.getUint16(offset + 10, true) + 1, true);
        break;
      }
    }
    await expect(inspectProjectArchive(new Blob([bytes]))).rejects.toThrow(/duplicate|ZIP is invalid/);
  });
});

describe('validation-first restore and compensating rollback', () => {
  beforeEach(async () => { await clearStoredFiles(); });

  const threeDocumentArchive = async () => {
    const state = workspace('ATOMIC');
    state.documents = [1, 2, 3].map(index => ({ ...state.documents[0], id: `DOC-ATOMIC-${index}`, filename: `synthetic-${index}.txt` }));
    for (const document of state.documents) {
      await saveUploadedFile(document.id, new File([`synthetic source ${document.id}`], document.filename, { type: 'text/plain' }));
      await saveExtractedText({ documentId: document.id, text: `synthetic text ${document.id}`, pageTexts: [`synthetic text ${document.id}`], pageCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
    }
    return exportProjectArchive('ATOMIC', state);
  };

  const memoryStorage = (fail: { file?: number; text?: number } = {}) => {
    const files = new Map<string, any>();
    const texts = new Map<string, any>();
    let fileWrites = 0;
    let textWrites = 0;
    const storage: ArchiveRestoreStorage = {
      getFile: async id => files.get(id), getText: async id => texts.get(id),
      putFile: async record => { fileWrites += 1; if (fileWrites === fail.file) throw new Error('synthetic file write failure'); files.set(record.documentId, record); },
      putText: async record => { textWrites += 1; if (textWrites === fail.text) throw new Error('synthetic text write failure'); texts.set(record.documentId, record); },
      deleteFile: async id => { files.delete(id); }, deleteText: async id => { texts.delete(id); },
    };
    return { files, texts, storage };
  };

  it.each([
    ['first record', { file: 1 }],
    ['middle record', { file: 2 }],
    ['final file record', { file: 3 }],
    ['first extracted-text record after all files', { text: 1 }],
    ['middle extracted-text record', { text: 2 }],
    ['final extracted-text record', { text: 3 }],
  ])('leaves no partial records after failure on the %s', async (_label, fail) => {
    const archive = await threeDocumentArchive();
    const memory = memoryStorage(fail);
    const map = Object.fromEntries([1, 2, 3].map(index => [`DOC-ATOMIC-${index}`, `DOC-DEST-${index}`]));
    await expect(restoreProjectArchive(archive, map, memory.storage)).rejects.toThrow(/rolled back/);
    expect(memory.files.size).toBe(0);
    expect(memory.texts.size).toBe(0);
  });

  it('rejects existing destinations without overwriting and succeeds cleanly on retry', async () => {
    const archive = await threeDocumentArchive();
    const collision = memoryStorage();
    collision.files.set('DOC-DEST-1', { documentId: 'DOC-DEST-1', marker: 'existing' });
    const map = Object.fromEntries([1, 2, 3].map(index => [`DOC-ATOMIC-${index}`, `DOC-DEST-${index}`]));
    await expect(restoreProjectArchive(archive, map, collision.storage)).rejects.toThrow(/collision/);
    expect(collision.files.get('DOC-DEST-1')).toMatchObject({ marker: 'existing' });
    expect(collision.texts.size).toBe(0);
    collision.files.clear();
    const restored = await restoreProjectArchive(archive, map, collision.storage);
    expect(restored.documents.map(document => document.id)).toEqual(['DOC-DEST-1', 'DOC-DEST-2', 'DOC-DEST-3']);
    expect(collision.files.size).toBe(3);
    expect(collision.texts.size).toBe(3);
  });

  it('does not mutate inspected or caller workspace objects and prepares deterministically', async () => {
    const state = workspace('IMMUTABLE');
    await saveUploadedFile('DOC-IMMUTABLE', new File(['immutable synthetic'], 'immutable.txt'));
    const before = structuredClone(state);
    const archive = await exportProjectArchive('IMMUTABLE', state);
    expect(state).toEqual(before);
    const inspected = await inspectProjectArchive(archive);
    const inspectedBefore = structuredClone(inspected.workspace);
    const one = memoryStorage();
    const two = memoryStorage();
    const first = await restoreProjectArchive(archive, { 'DOC-IMMUTABLE': 'DOC-DETERMINISTIC' }, one.storage);
    const second = await restoreProjectArchive(archive, { 'DOC-IMMUTABLE': 'DOC-DETERMINISTIC' }, two.storage);
    expect(first).toEqual(second);
    expect(inspected.workspace).toEqual(inspectedBefore);
  });

  it('rejects malformed extracted text and checksum failures before any write', async () => {
    const archive = await threeDocumentArchive();
    const malformed = await rewriteArchive(archive, async (zip, manifest) => replaceArtifact(zip, manifest, 'extracted-text/DOC-ATOMIC-2.json', '{broken'));
    const memory = memoryStorage();
    await expect(restoreProjectArchive(malformed, {}, memory.storage)).rejects.toThrow(/extracted text JSON is malformed/);
    expect(memory.files.size).toBe(0); expect(memory.texts.size).toBe(0);
    const checksum = await rewriteArchive(archive, zip => { zip.file('extracted-text/DOC-ATOMIC-3.json', 'tampered'); });
    await expect(restoreProjectArchive(checksum, {}, memory.storage)).rejects.toThrow(/(?:Checksum|size) verification failed/);
    expect(memory.files.size).toBe(0); expect(memory.texts.size).toBe(0);
  });
});
