import type { WorkspaceState } from './persistence';
import { commitImportedWorkspace } from './persistence';
import { deleteStoredFilesByDocumentIds } from './fileStorage';
import { deleteExtractedTextsByDocumentIds } from './extractedTextStorage';
import { reportSessionsKey, writeReportSessions } from './reportSessions';

export interface ArchiveImportCommitDependencies {
  storage: Storage;
  commitWorkspace(workspaceId: string, state: WorkspaceState): void;
  writeSessions(workspaceId: string, sessions: unknown[], storage: Storage): void;
  deleteFiles(documentIds: string[]): Promise<void>;
  deleteTexts(documentIds: string[]): Promise<void>;
}

const defaultDependencies = (): ArchiveImportCommitDependencies => ({
  storage: localStorage,
  commitWorkspace: commitImportedWorkspace,
  writeSessions: writeReportSessions,
  deleteFiles: deleteStoredFilesByDocumentIds,
  deleteTexts: deleteExtractedTextsByDocumentIds,
});

/**
 * Finalizes an already validated/restored archive. Workspace persistence and
 * activation are deliberately last; every earlier successful write records a
 * compensating rollback action.
 */
export async function commitRestoredArchive(
  workspaceId: string,
  restored: WorkspaceState,
  dependencies: ArchiveImportCommitDependencies = defaultDependencies()
): Promise<void> {
  const documentIds = restored.documents.map(document => document.id);
  const journal: Array<{ category: string; rollback: () => void | Promise<void> }> = [
    { category: 'source files', rollback: () => dependencies.deleteFiles(documentIds) },
    { category: 'extracted text', rollback: () => dependencies.deleteTexts(documentIds) },
  ];

  try {
    if (Array.isArray(restored.reportMetadata)) {
      const key = reportSessionsKey(workspaceId);
      const previous = dependencies.storage.getItem(key);
      dependencies.writeSessions(workspaceId, restored.reportMetadata, dependencies.storage);
      journal.push({
        category: 'report sessions',
        rollback: () => {
          if (previous === null) dependencies.storage.removeItem(key);
          else dependencies.storage.setItem(key, previous);
        },
      });
    }
    dependencies.commitWorkspace(workspaceId, restored);
  } catch (error) {
    const rollbackFailures: string[] = [];
    for (const action of [...journal].reverse()) {
      try { await action.rollback(); }
      catch { rollbackFailures.push(action.category); }
    }
    const original = error instanceof Error ? error.message : String(error);
    if (rollbackFailures.length) throw new Error(`Archive import failed and rollback was incomplete for ${rollbackFailures.join(', ')}. Original error: ${original}`);
    throw new Error(`Archive import failed; report sessions and restored local artifacts were rolled back. ${original}`);
  }
}
