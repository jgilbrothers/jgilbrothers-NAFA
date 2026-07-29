import type { WorkspaceState } from './persistence';
import { deleteUploadedFile, getUploadedFile, restoreUploadedFile, type StoredUploadedFile } from './fileStorage';
import { deleteExtractedText, getExtractedText, saveExtractedText, type StoredExtractedText } from './extractedTextStorage';
import { sha256 } from './fileIntegrity';
import { migrateLegacyTransactions } from './verifiedTransactions';
import { validateSavedReportSessions } from './reportSessions';

export const ARCHIVE_SCHEMA_VERSION = 'nafa-archive-v2';
export const ARCHIVE_LIMITS = Object.freeze({
  maxArchiveBytes: 1_000_000_000,
  maxDocuments: 500,
  maxEntries: 1_505,
  maxSourceFileBytes: 250_000_000,
  maxWorkspaceBytes: 25_000_000,
  maxExtractedTextBytes: 25_000_000,
  maxMetadataBytes: 65_536,
  maxManifestBytes: 1_000_000,
  maxDecompressedBytes: 2_000_000_000,
  maxCompressionRatio: 200,
  maxPathLength: 512,
});

interface ArchiveFileEntry { path: string; documentId: string; sha256: string; size: number }
interface ArchiveArtifactEntry { path: string; sha256: string; size: number }
export interface ArchiveManifest { schemaVersion: string; createdAt: string; workspaceId: string; files: ArchiveFileEntry[]; artifacts: ArchiveArtifactEntry[] }
interface PreparedArchive { manifest: ArchiveManifest; workspace: WorkspaceState; zip: any; files: StoredUploadedFile[]; texts: StoredExtractedText[] }
export interface ArchiveRestoreStorage {
  getFile(documentId: string): Promise<StoredUploadedFile | undefined>;
  getText(documentId: string): Promise<StoredExtractedText | undefined>;
  putFile(record: StoredUploadedFile): Promise<void>;
  putText(record: StoredExtractedText): Promise<void>;
  deleteFile(documentId: string): Promise<void>;
  deleteText(documentId: string): Promise<void>;
}
export interface ArchiveExportStorage {
  getFile(documentId: string): Promise<StoredUploadedFile | undefined>;
  getText(documentId: string): Promise<StoredExtractedText | undefined>;
}
const defaultExportStorage: ArchiveExportStorage = {
  getFile: getUploadedFile,
  getText: getExtractedText,
};
const defaultRestoreStorage: ArchiveRestoreStorage = {
  getFile: getUploadedFile,
  getText: getExtractedText,
  putFile: restoreUploadedFile,
  putText: saveExtractedText,
  deleteFile: deleteUploadedFile,
  deleteText: deleteExtractedText,
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const textBytes = (text: string) => new Blob([text]).size;
const isPlainObject = (value: unknown): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);

const invalidManifest = (reason: string): never => { throw new Error(`Archive manifest is invalid: ${reason}.`); };

const validateArchivePath = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value) invalidManifest(`${label} path must be a non-empty string`);
  const path = value as string;
  if (path.length > ARCHIVE_LIMITS.maxPathLength) invalidManifest(`${label} path exceeds ${ARCHIVE_LIMITS.maxPathLength} characters`);
  if (path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path)) invalidManifest(`${label} path must be relative`);
  if (path.includes('\\')) invalidManifest(`${label} path must use forward slashes`);
  if (path.split('/').some(segment => segment === '..' || segment === '.' || segment === '')) invalidManifest(`${label} path contains unsafe traversal or empty segments`);
  return path;
};

const validateSize = (value: unknown, label: string, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalidManifest(`${label} size must be a non-negative safe integer`);
  if ((value as number) > max) invalidManifest(`${label} size exceeds the supported limit of ${max} bytes`);
  return value as number;
};

const validateDigest = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) invalidManifest(`${label} sha256 must be a 64-character hexadecimal digest`);
  return (value as string).toLowerCase();
};

export const validateArchiveManifest = (value: unknown): ArchiveManifest => {
  if (!isPlainObject(value)) invalidManifest('root must be a non-null object');
  try { assertSafeJson(value, 'Archive manifest'); }
  catch (error) { invalidManifest(error instanceof Error ? error.message : 'contains prohibited object keys'); }
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    if (root.schemaVersion === 'nafa-archive-v1') invalidManifest('schema nafa-archive-v1 is not compatible because v1 metadata was not checksum-protected; re-export the project with this version');
    invalidManifest(`unsupported schema version ${String(root.schemaVersion)}`);
  }
  if (typeof root.createdAt !== 'string' || !root.createdAt) invalidManifest('createdAt must be a non-empty string');
  if (typeof root.workspaceId !== 'string' || !root.workspaceId) invalidManifest('workspaceId must be a non-empty string');
  if (!Array.isArray(root.files)) invalidManifest('files must be an array');
  if (!Array.isArray(root.artifacts)) invalidManifest('artifacts must be an array');
  const rawFiles = root.files as unknown[];
  const rawArtifacts = root.artifacts as unknown[];
  if (rawFiles.length > ARCHIVE_LIMITS.maxDocuments) invalidManifest(`files exceeds the ${ARCHIVE_LIMITS.maxDocuments}-document limit`);
  if (rawFiles.length + rawArtifacts.length > ARCHIVE_LIMITS.maxEntries) invalidManifest(`entry count exceeds ${ARCHIVE_LIMITS.maxEntries}`);

  const paths = new Set<string>();
  const documentIds = new Set<string>();
  const files = rawFiles.map((item: unknown, index: number): ArchiveFileEntry => {
    if (!isPlainObject(item)) invalidManifest(`files[${index}] must be an object`);
    const record = item as Record<string, unknown>;
    const path = validateArchivePath(record.path, `files[${index}]`);
    if (paths.has(path)) invalidManifest(`duplicate archive path ${path}`);
    paths.add(path);
    if (typeof record.documentId !== 'string' || !DOCUMENT_ID_PATTERN.test(record.documentId)) invalidManifest(`files[${index}] documentId is invalid`);
    const documentId = record.documentId as string;
    if (documentIds.has(documentId)) invalidManifest(`duplicate documentId ${documentId}`);
    documentIds.add(documentId);
    const legacyPrefix = `source-files/${documentId}/`;
    const contentPrefix = `${legacyPrefix}content/`;
    const legacySourcePath = path.startsWith(legacyPrefix) && path.slice(legacyPrefix.length).length > 0 && !path.slice(legacyPrefix.length).includes('/') && !path.endsWith('/metadata.json');
    const contentSourcePath = path.startsWith(contentPrefix) && path.slice(contentPrefix.length).length > 0 && !path.slice(contentPrefix.length).includes('/');
    if (!legacySourcePath && !contentSourcePath) invalidManifest(`files[${index}] path is inconsistent with documentId ${documentId}`);
    return { path, documentId, sha256: validateDigest(record.sha256, `files[${index}]`), size: validateSize(record.size, `files[${index}]`, ARCHIVE_LIMITS.maxSourceFileBytes) };
  });
  const artifacts = rawArtifacts.map((item: unknown, index: number): ArchiveArtifactEntry => {
    if (!isPlainObject(item)) invalidManifest(`artifacts[${index}] must be an object`);
    const record = item as Record<string, unknown>;
    const path = validateArchivePath(record.path, `artifacts[${index}]`);
    if (paths.has(path)) invalidManifest(`duplicate archive path ${path}`);
    paths.add(path);
    const max = path === 'workspace.json' ? ARCHIVE_LIMITS.maxWorkspaceBytes : path.endsWith('/metadata.json') ? ARCHIVE_LIMITS.maxMetadataBytes : ARCHIVE_LIMITS.maxExtractedTextBytes;
    return { path, sha256: validateDigest(record.sha256, `artifacts[${index}]`), size: validateSize(record.size, `artifacts[${index}]`, max) };
  });
  if (!artifacts.some(item => item.path === 'workspace.json')) invalidManifest('artifacts must include workspace.json');
  for (const file of files) {
    const metadataPath = `source-files/${file.documentId}/metadata.json`;
    if (!artifacts.some(item => item.path === metadataPath)) invalidManifest(`required metadata artifact is missing for document ${file.documentId}`);
  }
  for (const artifact of artifacts) {
    if (artifact.path === 'workspace.json') continue;
    const metadataMatch = artifact.path.match(/^source-files\/([^/]+)\/metadata\.json$/);
    const extractedMatch = artifact.path.match(/^extracted-text\/([^/]+)\.json$/);
    const referencedId = metadataMatch?.[1] || extractedMatch?.[1];
    if (!referencedId || !DOCUMENT_ID_PATTERN.test(referencedId)) invalidManifest(`artifact path has an invalid document reference: ${artifact.path}`);
    if (metadataMatch && !documentIds.has(referencedId)) invalidManifest(`metadata artifact has no retained source file: ${artifact.path}`);
  }
  return { schemaVersion: ARCHIVE_SCHEMA_VERSION, createdAt: root.createdAt as string, workspaceId: root.workspaceId as string, files, artifacts };
};

const assertSafeJson = (value: unknown, label: string, seen = new Set<object>()): void => {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value as object)) throw new Error(`${label} contains a cyclic object.`);
  seen.add(value as object);
  for (const key of Object.keys(value as object)) {
    if (PROHIBITED_KEYS.has(key)) throw new Error(`${label} contains prohibited key ${key}.`);
    assertSafeJson((value as Record<string, unknown>)[key], label, seen);
  }
  seen.delete(value as object);
};

const requireString = (value: unknown, label: string): void => {
  if (typeof value !== 'string' || !value) throw new Error(`Archive workspace data is invalid: ${label} must be a non-empty string.`);
};
const requireStringType = (value: unknown, label: string): void => {
  if (typeof value !== 'string') throw new Error(`Archive workspace data is invalid: ${label} must be a string.`);
};
const requireNumber = (value: unknown, label: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Archive workspace data is invalid: ${label} must be a finite number.`);
};
const requireBoolean = (value: unknown, label: string): void => {
  if (typeof value !== 'boolean') throw new Error(`Archive workspace data is invalid: ${label} must be a boolean.`);
};
const requireObject = (value: unknown, label: string): Record<string, any> => {
  if (!isPlainObject(value)) throw new Error(`Archive workspace data is invalid: ${label} must be an object.`);
  return value;
};
const requireCollection = (root: Record<string, any>, key: string): unknown[] => {
  if (!Array.isArray(root[key])) throw new Error(`Archive workspace data is invalid: ${key} must be an array.`);
  return root[key];
};

const validateTransactionMember = (value: unknown, label: string): void => {
  const item = requireObject(value, label);
  for (const key of ['transaction_id', 'transaction_date', 'raw_description', 'clean_vendor_name', 'transaction_type', 'processing_method', 'card_or_account_suffix', 'category']) requireString(item[key], `${label}.${key}`);
  requireNumber(item.amount, `${label}.amount`);
  requireBoolean(item.is_pending, `${label}.is_pending`);
};

const validateWorkspaceState: (value: unknown) => asserts value is WorkspaceState = (value: unknown): asserts value is WorkspaceState => {
  const root = requireObject(value, 'root');
  requireString(root.jurisdiction, 'jurisdiction');
  const documents = requireCollection(root, 'documents');
  const accounts = requireCollection(root, 'accounts');
  const transactions = requireCollection(root, 'transactions');
  const rules = requireCollection(root, 'rules');
  const reconItems = requireCollection(root, 'reconItems');
  const auditLogs = requireCollection(root, 'auditLogs');
  const chatLog = requireCollection(root, 'chatLog');

  documents.forEach((value, index) => {
    const item = requireObject(value, `documents[${index}]`);
    for (const key of ['id', 'filename', 'upload_timestamp', 'file_type', 'ocr_status', 'processing_status']) requireString(item[key], `documents[${index}].${key}`);
    requireStringType(item.institution_name, `documents[${index}].institution_name`);
    requireNumber(item.ocr_confidence, `documents[${index}].ocr_confidence`);
    if (item.sha256 !== undefined && (typeof item.sha256 !== 'string' || !SHA256_PATTERN.test(item.sha256))) throw new Error(`Archive workspace data is invalid: documents[${index}].sha256 must be a 64-character hexadecimal digest.`);
  });
  accounts.forEach((value, index) => {
    const item = requireObject(value, `accounts[${index}]`);
    for (const key of ['id', 'account_name', 'account_suffix', 'account_type', 'statement_period', 'account_status']) requireString(item[key], `accounts[${index}].${key}`);
    requireStringType(item.institution_name, `accounts[${index}].institution_name`);
    requireNumber(item.current_balance, `accounts[${index}].current_balance`);
    requireNumber(item.available_balance, `accounts[${index}].available_balance`);
  });
  transactions.forEach((item, index) => validateTransactionMember(item, `transactions[${index}]`));
  rules.forEach((value, index) => {
    const item = requireObject(value, `rules[${index}]`);
    for (const key of ['id', 'keyword', 'assigned_category', 'created_at']) requireString(item[key], `rules[${index}].${key}`);
    requireNumber(item.hits_count, `rules[${index}].hits_count`);
  });
  reconItems.forEach((value, index) => {
    const item = requireObject(value, `reconItems[${index}]`);
    for (const key of ['id', 'type', 'title', 'description', 'severity', 'status']) requireString(item[key], `reconItems[${index}].${key}`);
    if (item.transactionA !== undefined) validateTransactionMember(item.transactionA, `reconItems[${index}].transactionA`);
    if (item.transactionB !== undefined) validateTransactionMember(item.transactionB, `reconItems[${index}].transactionB`);
  });
  auditLogs.forEach((value, index) => {
    const item = requireObject(value, `auditLogs[${index}]`);
    for (const key of ['id', 'timestamp', 'action', 'details', 'level', 'operator']) requireString(item[key], `auditLogs[${index}].${key}`);
  });
  chatLog.forEach((value, index) => {
    const item = requireObject(value, `chatLog[${index}]`);
    for (const key of ['id', 'sender', 'text', 'timestamp']) requireString(item[key], `chatLog[${index}].${key}`);
  });
  if (root.reportMetadata !== undefined) validateSavedReportSessions(root.reportMetadata, 'Archive workspace data reportMetadata');
};

const validateMetadata = (value: unknown, expectedDocumentId: string, expectedSha256: string): Omit<StoredUploadedFile, 'blob'> => {
  if (!isPlainObject(value)) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: root must be a non-null object.`);
  assertSafeJson(value, `Archive metadata for document ${expectedDocumentId}`);
  if (value.documentId !== expectedDocumentId) throw new Error(`Archive metadata document ID disagreement for ${expectedDocumentId}.`);
  for (const key of ['originalFileName', 'mimeType', 'uploadedAt']) if (typeof value[key] !== 'string' || !value[key]) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: ${key} must be a non-empty string.`);
  if (/[/\\\u0000-\u001f]/.test(value.originalFileName) || value.originalFileName.length > 255) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: originalFileName is unsafe.`);
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(value.mimeType)) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: mimeType is invalid.`);
  if (Number.isNaN(Date.parse(value.uploadedAt))) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: uploadedAt is invalid.`);
  if (value.sha256 !== expectedSha256) throw new Error(`Archive metadata source checksum disagreement for document ${expectedDocumentId}.`);
  if (!Number.isSafeInteger(value.size) || value.size < 0 || value.size > ARCHIVE_LIMITS.maxSourceFileBytes) throw new Error(`Archive metadata is invalid for document ${expectedDocumentId}: size is invalid.`);
  return { documentId: expectedDocumentId, originalFileName: value.originalFileName, mimeType: value.mimeType, size: value.size, uploadedAt: value.uploadedAt };
};

const validateExtractedText = (value: unknown, expectedDocumentId: string): StoredExtractedText => {
  if (!isPlainObject(value)) throw new Error(`Archive extracted text is invalid for document ${expectedDocumentId}: root must be a non-null object.`);
  assertSafeJson(value, `Archive extracted text for document ${expectedDocumentId}`);
  if (value.documentId !== expectedDocumentId) throw new Error(`Archive extracted text document ID disagreement for ${expectedDocumentId}.`);
  if (typeof value.text !== 'string' || !Array.isArray(value.pageTexts) || !value.pageTexts.every((item: unknown) => typeof item === 'string')) throw new Error(`Archive extracted text is invalid for document ${expectedDocumentId}: text and pageTexts are required.`);
  if (!Number.isSafeInteger(value.pageCount) || value.pageCount < 0 || typeof value.updatedAt !== 'string') throw new Error(`Archive extracted text is invalid for document ${expectedDocumentId}: pageCount or updatedAt is invalid.`);
  return value as StoredExtractedText;
};

const verifyEntry = async (zip: any, expected: ArchiveFileEntry | ArchiveArtifactEntry): Promise<ArrayBuffer> => {
  const entry = zip.file(expected.path);
  if (!entry) throw new Error(`Archive required entry is missing: ${expected.path}.`);
  const compressed = Number(entry?._data?.compressedSize || 0);
  if (compressed > 0 && expected.size / compressed > ARCHIVE_LIMITS.maxCompressionRatio) throw new Error(`Archive entry has an unreasonable compression ratio: ${expected.path}.`);
  const bytes = await entry.async('arraybuffer');
  if (bytes.byteLength !== expected.size) throw new Error(`Archive size verification failed for ${expected.path}.`);
  if (await sha256(bytes) !== expected.sha256) throw new Error(`Checksum verification failed for ${expected.path}.`);
  return bytes;
};

const metadataPathFor = (documentId: string) => `source-files/${documentId}/metadata.json`;

const readZipEntryCount = (buffer: ArrayBuffer): number => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      const count = view.getUint16(offset + 10, true);
      if (count === 0xffff) throw new Error('Archive ZIP64 entry tables are not supported.');
      return count;
    }
  }
  throw new Error('Archive ZIP is invalid: end-of-central-directory record is missing.');
};

export async function exportProjectArchive(workspaceId: string, state: WorkspaceState, onProgress?: (completed: number, total: number) => void, storage: ArchiveExportStorage = defaultExportStorage): Promise<Blob> {
  assertSafeJson(state, 'Workspace');
  const stateCopy = structuredClone(state);
  validateWorkspaceState(stateCopy);
  if (stateCopy.documents.length > ARCHIVE_LIMITS.maxDocuments) throw new Error(`Archive contains more than ${ARCHIVE_LIMITS.maxDocuments} documents.`);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const workspaceJson = JSON.stringify(stateCopy, null, 2);
  if (textBytes(workspaceJson) > ARCHIVE_LIMITS.maxWorkspaceBytes) throw new Error('Archive workspace data exceeds the supported size limit.');
  zip.file('workspace.json', workspaceJson);
  const manifest: ArchiveManifest = { schemaVersion: ARCHIVE_SCHEMA_VERSION, createdAt: new Date().toISOString(), workspaceId, files: [], artifacts: [{ path: 'workspace.json', sha256: await sha256(new Blob([workspaceJson])), size: textBytes(workspaceJson) }] };
  let complete = 0;
  const total = stateCopy.documents.length * 2;
  for (const document of stateCopy.documents) {
    const claimsSourceFile = document.source_file_status === 'stored' || document.local_file?.stored === true;
    const file = await storage.getFile(document.id).catch(error => {
      if (claimsSourceFile) throw new Error(`Complete archive stopped: the retained source file for ${document.filename || document.id} could not be read. ${error instanceof Error ? error.message : ''}`.trim());
      return undefined;
    });
    if (claimsSourceFile && !file?.blob) throw new Error(`Complete archive stopped: ${document.filename || document.id} claims a retained source file, but its stored bytes are missing.`);
    if (file?.blob) {
      if (file.documentId !== document.id) throw new Error(`Complete archive stopped: the retained source-file record is inconsistent for document ${document.id}.`);
      if (file.blob.size > ARCHIVE_LIMITS.maxSourceFileBytes) throw new Error(`Source file ${file.originalFileName} exceeds the archive size limit.`);
      if (file.size !== file.blob.size) throw new Error(`Complete archive stopped: retained source-file size metadata is inconsistent for document ${document.id}.`);
      const checksum = await sha256(file.blob);
      validateMetadata({ ...file, size: file.blob.size, sha256: checksum }, document.id, checksum);
      const path = `source-files/${file.documentId}/content/${encodeURIComponent(file.originalFileName)}`;
      validateArchivePath(path, 'source file');
      zip.file(path, await file.blob.arrayBuffer());
      const metadataPath = metadataPathFor(file.documentId);
      const metadataJson = JSON.stringify({ documentId: file.documentId, originalFileName: file.originalFileName, mimeType: file.mimeType, size: file.blob.size, uploadedAt: file.uploadedAt, sha256: checksum }, null, 2);
      if (textBytes(metadataJson) > ARCHIVE_LIMITS.maxMetadataBytes) throw new Error(`Metadata for ${file.originalFileName} exceeds the archive size limit.`);
      zip.file(metadataPath, metadataJson);
      manifest.files.push({ path, documentId: file.documentId, sha256: checksum, size: file.blob.size });
      manifest.artifacts.push({ path: metadataPath, sha256: await sha256(new Blob([metadataJson])), size: textBytes(metadataJson) });
    }
    onProgress?.(++complete, total);
    const claimsExtractedText = document.extracted_text_available === true || Boolean(document.extracted_text_id);
    const extracted = await storage.getText(document.id).catch(error => {
      if (claimsExtractedText) throw new Error(`Complete archive stopped: extracted text for document ${document.id} could not be read. ${error instanceof Error ? error.message : ''}`.trim());
      return undefined;
    });
    if (claimsExtractedText && !extracted) throw new Error(`Complete archive stopped: document ${document.id} claims extracted text, but its stored extracted-text record is missing.`);
    if (extracted) {
      validateExtractedText(extracted, document.id);
      const path = `extracted-text/${extracted.documentId}.json`;
      const contents = JSON.stringify(extracted, null, 2);
      if (textBytes(contents) > ARCHIVE_LIMITS.maxExtractedTextBytes) throw new Error(`Extracted text for ${document.id} exceeds the archive size limit.`);
      zip.file(path, contents);
      manifest.artifacts.push({ path, sha256: await sha256(new Blob([contents])), size: textBytes(contents) });
    }
    onProgress?.(++complete, total);
  }
  validateArchiveManifest(manifest);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function inspectProjectArchive(blob: Blob): Promise<{ manifest: ArchiveManifest; workspace: WorkspaceState; zip: any }> {
  if (blob.size > ARCHIVE_LIMITS.maxArchiveBytes) throw new Error(`Archive exceeds the ${ARCHIVE_LIMITS.maxArchiveBytes}-byte compressed size limit.`);
  const { default: JSZip } = await import('jszip');
  let zip: any;
  const archiveBuffer = await blob.arrayBuffer();
  const declaredZipEntries = readZipEntryCount(archiveBuffer);
  const maxZipEntries = ARCHIVE_LIMITS.maxEntries + (ARCHIVE_LIMITS.maxDocuments * 2) + 3;
  if (declaredZipEntries > maxZipEntries) throw new Error(`Archive contains more than ${maxZipEntries} ZIP entries.`);
  try { zip = await JSZip.loadAsync(archiveBuffer, { checkCRC32: true, createFolders: false }); }
  catch (error) { throw new Error(`Archive ZIP is invalid: ${error instanceof Error ? error.message : 'unable to read ZIP'}.`); }
  const entries = Object.values(zip.files) as any[];
  if (entries.length !== declaredZipEntries) throw new Error('Archive contains duplicate or ambiguously decoded ZIP entry names.');
  const fileEntries = entries.filter(entry => !entry.dir);
  if (fileEntries.length > ARCHIVE_LIMITS.maxEntries + 1) throw new Error(`Archive contains more than ${ARCHIVE_LIMITS.maxEntries + 1} non-directory ZIP entries.`);
  for (const entry of entries) if (!entry.dir) validateArchivePath(entry.name, 'ZIP entry');
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new Error('Archive is missing manifest.json.');
  const manifestUncompressedSize = Number(manifestEntry?._data?.uncompressedSize || 0);
  const manifestCompressedSize = Number(manifestEntry?._data?.compressedSize || 0);
  if (manifestUncompressedSize > ARCHIVE_LIMITS.maxManifestBytes) throw new Error('Archive manifest exceeds the supported size limit.');
  if (manifestCompressedSize > 0 && manifestUncompressedSize / manifestCompressedSize > ARCHIVE_LIMITS.maxCompressionRatio) throw new Error('Archive manifest has an unreasonable compression ratio.');
  let rawManifest: unknown;
  try { rawManifest = JSON.parse(await manifestEntry.async('text')); }
  catch { throw new Error('Archive manifest is invalid: JSON could not be parsed.'); }
  const manifest = validateArchiveManifest(rawManifest);
  const allowedPaths = new Set(['manifest.json', ...manifest.files.map(item => item.path), ...manifest.artifacts.map(item => item.path)]);
  for (const entry of entries) if (!entry.dir && !allowedPaths.has(entry.name)) throw new Error(`Archive contains an unexpected entry: ${entry.name}.`);
  const declaredTotal = [...manifest.files, ...manifest.artifacts].reduce((sum, item) => sum + item.size, 0);
  if (!Number.isSafeInteger(declaredTotal) || declaredTotal > ARCHIVE_LIMITS.maxDecompressedBytes) throw new Error('Archive decompressed-size limit exceeded.');
  const workspaceExpected = manifest.artifacts.find(item => item.path === 'workspace.json')!;
  const workspaceBytes = await verifyEntry(zip, workspaceExpected);
  let workspace: unknown;
  try { workspace = JSON.parse(new TextDecoder().decode(workspaceBytes)); }
  catch { throw new Error('Archive workspace data is invalid: JSON could not be parsed.'); }
  assertSafeJson(workspace, 'Archive workspace data');
  validateWorkspaceState(workspace);
  if (workspace.documents.length > ARCHIVE_LIMITS.maxDocuments) throw new Error(`Archive workspace exceeds the ${ARCHIVE_LIMITS.maxDocuments}-document limit.`);
  const workspaceIds = new Set<string>();
  for (const [index, document] of workspace.documents.entries()) {
    if (!isPlainObject(document) || typeof document.id !== 'string' || !DOCUMENT_ID_PATTERN.test(document.id)) throw new Error(`Archive workspace document ${index} has an invalid ID.`);
    if (workspaceIds.has(document.id)) throw new Error(`Archive workspace contains duplicate document ID ${document.id}.`);
    workspaceIds.add(document.id);
  }
  for (const file of manifest.files) if (!workspaceIds.has(file.documentId)) throw new Error(`Archive manifest references unknown document ID ${file.documentId}.`);
  for (const artifact of manifest.artifacts) {
    const extractedId = artifact.path.match(/^extracted-text\/([^/]+)\.json$/)?.[1];
    if (extractedId && !workspaceIds.has(extractedId)) throw new Error(`Archive extracted-text artifact references unknown document ID ${extractedId}.`);
  }
  for (const expected of [...manifest.files, ...manifest.artifacts]) await verifyEntry(zip, expected);
  return { manifest, workspace: structuredClone(workspace), zip };
}

const remapReferences = (value: unknown, idMap: Record<string, string>, key = ''): unknown => {
  if (Array.isArray(value)) return value.map(item => remapReferences(item, idMap, key));
  if (!isPlainObject(value)) {
    const referenceKeys = new Set(['documentId', 'document_id', 'documentIds', 'document_ids', 'source_document_id', 'sourceDocumentId', 'source_document_ids', 'sourceDocumentIds']);
    return typeof value === 'string' && referenceKeys.has(key) ? (idMap[value] || value) : value;
  }
  const copy: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value)) copy[childKey] = remapReferences(child, idMap, childKey);
  return copy;
};

const prepareProjectArchive = async (blob: Blob, documentIdMap: Record<string, string>): Promise<PreparedArchive> => {
  const { manifest, workspace, zip } = await inspectProjectArchive(blob);
  const sourceIds = new Set(workspace.documents.map(document => document.id));
  for (const key of Object.keys(documentIdMap)) if (!sourceIds.has(key)) throw new Error(`Document ID map contains unknown source ID ${key}.`);
  const targetIds = workspace.documents.map(document => documentIdMap[document.id] || document.id);
  if (targetIds.some(id => typeof id !== 'string' || !id)) throw new Error('Document ID map contains an invalid destination ID.');
  if (new Set(targetIds).size !== targetIds.length) throw new Error('Document ID collision: multiple archive documents map to the same destination ID.');

  const preparedFiles: StoredUploadedFile[] = [];
  for (const expected of manifest.files) {
    const targetDocumentId = documentIdMap[expected.documentId] || expected.documentId;
    const metadataExpected = manifest.artifacts.find(item => item.path === metadataPathFor(expected.documentId));
    if (!metadataExpected) throw new Error(`Archive metadata is missing for document ${expected.documentId}.`);
    const metadataBytes = await verifyEntry(zip, metadataExpected);
    let parsedMetadata: unknown;
    try { parsedMetadata = JSON.parse(new TextDecoder().decode(metadataBytes)); }
    catch { throw new Error(`Archive metadata JSON is malformed for document ${expected.documentId}.`); }
    const metadata = validateMetadata(parsedMetadata, expected.documentId, expected.sha256);
    let pathFileName: string;
    try { pathFileName = decodeURIComponent(expected.path.split('/').at(-1) || ''); }
    catch { throw new Error(`Archive source filename encoding is invalid for document ${expected.documentId}.`); }
    if (pathFileName !== metadata.originalFileName) throw new Error(`Archive metadata filename disagrees with the verified source path for document ${expected.documentId}.`);
    const workspaceDocument = workspace.documents.find(document => document.id === expected.documentId);
    if (workspaceDocument?.mime_type && workspaceDocument.mime_type !== metadata.mimeType) throw new Error(`Archive metadata MIME type disagrees with workspace document ${expected.documentId}.`);
    const sourceBytes = await verifyEntry(zip, expected);
    if (workspaceDocument?.sha256 && workspaceDocument.sha256.toLowerCase() !== expected.sha256) throw new Error(`Archive workspace source checksum disagrees with verified source bytes for document ${expected.documentId}.`);
    if (metadata.size !== sourceBytes.byteLength) throw new Error(`Archive metadata size disagrees with source bytes for document ${expected.documentId}.`);
    preparedFiles.push({ ...metadata, documentId: targetDocumentId, blob: new Blob([sourceBytes], { type: metadata.mimeType }) });
  }

  const preparedTexts: StoredExtractedText[] = [];
  for (const document of workspace.documents) {
    const path = `extracted-text/${document.id}.json`;
    const expected = manifest.artifacts.find(item => item.path === path);
    if (!expected) continue;
    const bytes = await verifyEntry(zip, expected);
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new Error(`Archive extracted text JSON is malformed for document ${document.id}.`); }
    const extracted = validateExtractedText(parsed, document.id);
    const targetDocumentId = documentIdMap[document.id] || document.id;
    preparedTexts.push({ ...(remapReferences(extracted, documentIdMap) as StoredExtractedText), documentId: targetDocumentId });
  }
  const restoredWorkspace = remapReferences(workspace, documentIdMap) as WorkspaceState;
  restoredWorkspace.transactions = migrateLegacyTransactions(restoredWorkspace.transactions);
  restoredWorkspace.documents = workspace.documents.map(document => {
    const id = documentIdMap[document.id] || document.id;
    const restored = manifest.files.some(file => file.documentId === document.id);
    const sourceStatus = restored ? 'stored' : document.source_file_status === 'metadata_only' ? 'metadata_only' : 'unavailable';
    return { ...remapReferences(document, documentIdMap) as typeof document, id, source_file_status: sourceStatus, local_file: { storage: 'indexeddb', stored: restored } };
  });
  return { manifest, workspace: restoredWorkspace, zip, files: preparedFiles, texts: preparedTexts };
};

export async function restoreProjectArchive(blob: Blob, documentIdMap: Record<string, string> = {}, storage: ArchiveRestoreStorage = defaultRestoreStorage): Promise<WorkspaceState> {
  const prepared = await prepareProjectArchive(blob, { ...documentIdMap });
  const targetIds = new Set([...prepared.files.map(item => item.documentId), ...prepared.texts.map(item => item.documentId)]);
  for (const id of targetIds) {
    if (await storage.getFile(id) || await storage.getText(id)) throw new Error(`Archive restore collision: destination document ${id} already has local records.`);
  }
  const rollbackJournal: Array<{ category: 'source file' | 'extracted text'; documentId: string; rollback: () => Promise<void> }> = [];
  try {
    for (const file of prepared.files) {
      await storage.putFile(file);
      rollbackJournal.push({ category: 'source file', documentId: file.documentId, rollback: () => storage.deleteFile(file.documentId) });
    }
    for (const extracted of prepared.texts) {
      await storage.putText(extracted);
      rollbackJournal.push({ category: 'extracted text', documentId: extracted.documentId, rollback: () => storage.deleteText(extracted.documentId) });
    }
  } catch (error) {
    const failed: string[] = [];
    for (const action of [...rollbackJournal].reverse()) {
      try { await action.rollback(); }
      catch { failed.push(`${action.category} ${action.documentId}`); }
    }
    if (failed.length) throw new Error(`Archive restore failed and rollback was incomplete for ${failed.join(', ')}. Original error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Archive restore failed before completion; all newly written local records were rolled back. ${error instanceof Error ? error.message : String(error)}`);
  }
  return structuredClone(prepared.workspace);
}
