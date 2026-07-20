import type { WorkspaceState } from './persistence';
import { getAllUploadedFiles, restoreUploadedFile } from './fileStorage';
import { getAllExtractedTexts, saveExtractedText } from './extractedTextStorage';
import { sha256 } from './fileIntegrity';

export const ARCHIVE_SCHEMA_VERSION = 'nafa-archive-v1';
export interface ArchiveManifest { schemaVersion: string; createdAt: string; workspaceId: string; files: Array<{ path: string; documentId: string; sha256: string; size: number }>; artifacts: Array<{ path: string; sha256: string; size: number }>; }

export async function exportProjectArchive(workspaceId: string, state: WorkspaceState, onProgress?: (completed: number, total: number) => void): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const workspaceJson = JSON.stringify(state, null, 2);
  zip.file('workspace.json', workspaceJson);
  const documentIds = new Set(state.documents.map(document => document.id));
  const files = (await getAllUploadedFiles()).filter(file => documentIds.has(file.documentId));
  const texts = (await getAllExtractedTexts()).filter(text => documentIds.has(text.documentId));
  const missingExpectedFiles = state.documents.filter(document => document.source_file_status === 'stored' && !files.some(file => file.documentId === document.id));
  if (missingExpectedFiles.length) throw new Error(`Complete archive stopped: ${missingExpectedFiles.length} document(s) claim a stored source file but the blob is absent.`);
  const manifest: ArchiveManifest = { schemaVersion: ARCHIVE_SCHEMA_VERSION, createdAt: new Date().toISOString(), workspaceId, files: [], artifacts: [{ path: 'workspace.json', sha256: await sha256(new Blob([workspaceJson])), size: new Blob([workspaceJson]).size }] };
  let complete = 0;
  const total = files.length + texts.length;
  for (const file of files) {
    const checksum = await sha256(file.blob);
    const path = `source-files/${file.documentId}/${encodeURIComponent(file.originalFileName)}`;
    zip.file(path, await file.blob.arrayBuffer());
    zip.file(`source-files/${file.documentId}/metadata.json`, JSON.stringify({ ...file, blob: undefined, sha256: checksum }, null, 2));
    manifest.files.push({ path, documentId: file.documentId, sha256: checksum, size: file.blob.size });
    onProgress?.(++complete, total);
  }
  for (const text of texts) {
    const path = `extracted-text/${text.documentId}.json`;
    const contents = JSON.stringify(text, null, 2);
    zip.file(path, contents);
    manifest.artifacts.push({ path, sha256: await sha256(new Blob([contents])), size: new Blob([contents]).size });
    onProgress?.(++complete, total);
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function inspectProjectArchive(blob: Blob): Promise<{ manifest: ArchiveManifest; workspace: WorkspaceState; zip: any }> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
  const manifestEntry = zip.file('manifest.json');
  const workspaceEntry = zip.file('workspace.json');
  if (!manifestEntry || !workspaceEntry) throw new Error('Archive is missing manifest.json or workspace.json.');
  const manifest = JSON.parse(await manifestEntry.async('text')) as ArchiveManifest;
  if (manifest.schemaVersion !== ARCHIVE_SCHEMA_VERSION) throw new Error(`Unsupported archive schema: ${manifest.schemaVersion}`);
  const workspace = JSON.parse(await workspaceEntry.async('text')) as WorkspaceState;
  if (!Array.isArray(workspace.documents) || !Array.isArray(workspace.transactions)) throw new Error('Archive workspace data is invalid.');
  for (const expected of manifest.files) {
    const entry = zip.file(expected.path);
    if (!entry) throw new Error(`Archive source file is missing: ${expected.path}`);
    const fileBlob = new Blob([await entry.async('arraybuffer')]);
    if (await sha256(fileBlob) !== expected.sha256) throw new Error(`Checksum verification failed for document ${expected.documentId}.`);
  }
  for (const expected of manifest.artifacts || []) {
    const entry = zip.file(expected.path);
    if (!entry) throw new Error(`Archive artifact is missing: ${expected.path}`);
    const artifact = new Blob([await entry.async('arraybuffer')]);
    if (await sha256(artifact) !== expected.sha256) throw new Error(`Checksum verification failed for ${expected.path}.`);
  }
  return { manifest, workspace, zip };
}

export async function restoreProjectArchive(blob: Blob, documentIdMap: Record<string, string> = {}): Promise<WorkspaceState> {
  const { manifest, workspace, zip } = await inspectProjectArchive(blob);
  for (const expected of manifest.files) {
    const targetDocumentId = documentIdMap[expected.documentId] || expected.documentId;
    const metadataEntry = zip.file(`source-files/${expected.documentId}/metadata.json`);
    const metadata = metadataEntry ? JSON.parse(await metadataEntry.async('text')) : {};
    const sourceBlob = new Blob([await zip.file(expected.path)!.async('arraybuffer')], { type: metadata.mimeType || 'application/octet-stream' });
    await restoreUploadedFile({ documentId: targetDocumentId, originalFileName: metadata.originalFileName || expected.path.split('/').at(-1) || 'source-file', mimeType: metadata.mimeType || sourceBlob.type, size: sourceBlob.size, uploadedAt: metadata.uploadedAt || new Date().toISOString(), blob: sourceBlob });
  }
  for (const document of workspace.documents) {
    const originalDocumentId = document.id;
    const targetDocumentId = documentIdMap[originalDocumentId] || originalDocumentId;
    const entry = zip.file(`extracted-text/${originalDocumentId}.json`);
    if (entry) {
      const extracted = JSON.parse(await entry.async('text'));
      const structuredData = extracted.structuredData && typeof extracted.structuredData === 'object' ? {
        ...extracted.structuredData,
        candidates: Array.isArray(extracted.structuredData.candidates) ? extracted.structuredData.candidates.map((candidate: any) => ({ ...candidate, documentId: targetDocumentId })) : extracted.structuredData.candidates,
        legalCandidates: Array.isArray(extracted.structuredData.legalCandidates) ? extracted.structuredData.legalCandidates.map((candidate: any) => ({ ...candidate, documentId: targetDocumentId })) : extracted.structuredData.legalCandidates,
      } : extracted.structuredData;
      await saveExtractedText({ ...extracted, documentId: targetDocumentId, structuredData });
    }
    const restored = manifest.files.some(file => file.documentId === originalDocumentId);
    document.id = targetDocumentId;
    document.source_file_status = restored ? 'stored' : 'unavailable';
    document.local_file = { storage: 'indexeddb', stored: restored };
  }
  workspace.transactions = workspace.transactions.map(transaction => ({ ...transaction, source_document_id: transaction.source_document_id ? (documentIdMap[transaction.source_document_id] || transaction.source_document_id) : undefined }));
  workspace.reconItems = workspace.reconItems.map(item => ({ ...item, documentId: item.documentId ? (documentIdMap[item.documentId] || item.documentId) : undefined }));
  return workspace;
}
