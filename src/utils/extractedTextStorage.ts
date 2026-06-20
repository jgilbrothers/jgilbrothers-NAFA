const DB_NAME = 'nafa-ledger-extracted-text';
const STORE_NAME = 'document-text';
const DB_VERSION = 1;

export interface StoredExtractedText {
  documentId: string;
  text: string;
  pageTexts: string[];
  pageCount: number;
  updatedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      dbPromise = null;
      reject(new Error('IndexedDB is not available for extracted text storage.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'documentId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Unable to open extracted text storage.'));
    };
  });
  return dbPromise;
};

const withStore = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = action(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Extracted text storage request failed.'));
    tx.onerror = () => reject(tx.error || new Error('Extracted text storage transaction failed.'));
  });
};

export async function saveExtractedText(record: StoredExtractedText): Promise<void> {
  await withStore('readwrite', store => store.put(record));
}

export async function getExtractedText(documentId: string): Promise<StoredExtractedText | undefined> {
  return withStore('readonly', store => store.get(documentId));
}

export async function deleteExtractedText(documentId: string): Promise<void> {
  await withStore('readwrite', store => store.delete(documentId));
}
