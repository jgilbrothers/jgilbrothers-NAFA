import { DocumentRecord } from '../types';

const DB_NAME = 'nafa-ledger-source-files';
const STORE_NAME = 'uploaded-files';
const DB_VERSION = 1;

export interface StoredUploadedFile {
  documentId: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  blob: Blob;
}

let fileDbPromise: Promise<IDBDatabase> | null = null;

const openFileDb = (): Promise<IDBDatabase> => {
  if (fileDbPromise) return fileDbPromise;

  fileDbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      fileDbPromise = null;
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'documentId' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => { fileDbPromise = null; };
      db.onerror = () => { fileDbPromise = null; };
      db.onversionchange = () => {
        db.close();
        fileDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      fileDbPromise = null;
      reject(request.error || new Error('Unable to open local file storage.'));
    };
    request.onblocked = () => {
      fileDbPromise = null;
      reject(new Error('Local file storage is blocked by another browser tab.'));
    };
  });

  return fileDbPromise;
};

const withStore = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local file storage request failed.'));
    tx.onerror = () => {
      reject(tx.error || new Error('Local file storage transaction failed.'));
    };
  });
};

export async function saveUploadedFile(documentId: string, file: File): Promise<StoredUploadedFile> {
  const record: StoredUploadedFile = {
    documentId,
    originalFileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedAt: new Date().toISOString(),
    blob: file,
  };
  await withStore('readwrite', store => store.put(record));
  return record;
}

export async function getUploadedFile(documentId: string): Promise<StoredUploadedFile | undefined> {
  return withStore('readonly', store => store.get(documentId));
}

export async function deleteUploadedFile(documentId: string): Promise<void> {
  await withStore('readwrite', store => store.delete(documentId));
}

export async function hasStoredFile(documentId: string): Promise<boolean> {
  const file = await getUploadedFile(documentId);
  return Boolean(file?.blob);
}

export async function clearStoredFiles(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}

export async function deleteStoredFilesByDocumentIds(documentIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(documentIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  const db = await openFileDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    uniqueIds.forEach(id => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Unable to delete scoped local source files.'));
    tx.onabort = () => reject(tx.error || new Error('Scoped local source file deletion was aborted.'));
  });
}

export async function getStoredFileStats(): Promise<{ count: number; bytes: number }> {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    let count = 0;
    let bytes = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const value = cursor.value as StoredUploadedFile;
        count += 1;
        bytes += value.size || value.blob?.size || 0;
        cursor.continue();
      } else {
        resolve({ count, bytes });
      }
    };
    request.onerror = () => reject(request.error || new Error('Unable to read local file storage stats.'));
    tx.onerror = () => {
      reject(tx.error || new Error('Unable to read local file storage stats.'));
    };
  });
}

export function documentHasAvailableSourceFile(doc: DocumentRecord): boolean {
  return doc.source_file_status === 'stored' || Boolean(doc.local_file?.stored);
}
