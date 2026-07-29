import { describe, expect, it, vi } from 'vitest';
import { commitRestoredArchive, type ArchiveImportCommitDependencies } from '../archiveImportCommit';
import { reportSessionsKey } from '../reportSessions';
import type { WorkspaceState } from '../persistence';

const workspace = (): WorkspaceState => ({
  accounts: [], transactions: [], rules: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina',
  documents: [{ id: 'DOC-IMPORT-1', filename: 'synthetic.txt', upload_timestamp: '2026-01-01T00:00:00.000Z', file_type: 'Other', ocr_status: 'not_started', ocr_confidence: 0, institution_name: '', processing_status: 'Requires Verification' }],
  reportMetadata: [{ id: 'REPORT-1', name: 'Synthetic report' }],
});

const memoryStorage = () => {
  const values = new Map<string, string>([['nafa_ledger_active_workspace_id_v1', 'WS-EXISTING']]);
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
  return { values, storage };
};

const dependencies = (overrides: Partial<ArchiveImportCommitDependencies> = {}) => {
  const memory = memoryStorage();
  const events: string[] = [];
  const deps: ArchiveImportCommitDependencies = {
    storage: memory.storage,
    writeSessions: (id, sessions, storage) => { events.push('write reports'); storage.setItem(reportSessionsKey(id), JSON.stringify(sessions)); },
    commitWorkspace: id => { events.push('commit workspace'); memory.storage.setItem('nafa_ledger_active_workspace_id_v1', id); },
    deleteFiles: async () => { events.push('delete files'); },
    deleteTexts: async () => { events.push('delete texts'); },
    ...overrides,
  };
  return { ...memory, events, deps };
};

describe('complete archive import commit boundary', () => {
  it('persists report sessions before the final workspace activation', async () => {
    const fixture = dependencies();
    await commitRestoredArchive('WS-IMPORT', workspace(), fixture.deps);
    expect(fixture.events).toEqual(['write reports', 'commit workspace']);
    expect(fixture.values.get('nafa_ledger_active_workspace_id_v1')).toBe('WS-IMPORT');
    expect(JSON.parse(fixture.values.get(reportSessionsKey('WS-IMPORT'))!)).toEqual(workspace().reportMetadata);
  });

  it('removes restored artifacts when report-session persistence fails', async () => {
    const deleteFiles = vi.fn(async () => undefined);
    const deleteTexts = vi.fn(async () => undefined);
    const fixture = dependencies({ writeSessions: () => { throw new Error('synthetic report quota failure'); }, deleteFiles, deleteTexts });
    await expect(commitRestoredArchive('WS-IMPORT', workspace(), fixture.deps)).rejects.toThrow(/report sessions and restored local artifacts were rolled back/);
    expect(deleteFiles).toHaveBeenCalledWith(['DOC-IMPORT-1']);
    expect(deleteTexts).toHaveBeenCalledWith(['DOC-IMPORT-1']);
    expect(fixture.values.get('nafa_ledger_active_workspace_id_v1')).toBe('WS-EXISTING');
  });

  it('restores prior report sessions and artifacts when workspace persistence fails', async () => {
    const fixture = dependencies({ commitWorkspace: () => { throw new Error('synthetic workspace quota failure'); } });
    fixture.values.set(reportSessionsKey('WS-IMPORT'), JSON.stringify([{ id: 'PRIOR' }]));
    await expect(commitRestoredArchive('WS-IMPORT', workspace(), fixture.deps)).rejects.toThrow(/rolled back/);
    expect(JSON.parse(fixture.values.get(reportSessionsKey('WS-IMPORT'))!)).toEqual([{ id: 'PRIOR' }]);
    expect(fixture.events).toEqual(['write reports', 'delete texts', 'delete files']);
    expect(fixture.values.get('nafa_ledger_active_workspace_id_v1')).toBe('WS-EXISTING');
  });

  it('continues rollback after cleanup failure and identifies the affected category', async () => {
    const deleteFiles = vi.fn(async () => undefined);
    const deleteTexts = vi.fn(async () => { throw new Error('synthetic text cleanup failure'); });
    const fixture = dependencies({
      commitWorkspace: () => { throw new Error('synthetic workspace failure'); },
      deleteFiles,
      deleteTexts,
    });
    await expect(commitRestoredArchive('WS-IMPORT', workspace(), fixture.deps)).rejects.toThrow(/rollback was incomplete for extracted text.*Original error: synthetic workspace failure/);
    expect(deleteTexts).toHaveBeenCalledOnce();
    expect(deleteFiles).toHaveBeenCalledOnce();
    expect(fixture.values.has(reportSessionsKey('WS-IMPORT'))).toBe(false);
  });
});
