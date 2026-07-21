import { afterEach, describe, expect, it } from 'vitest';
import { commitImportedWorkspace, type WorkspaceState } from '../persistence';

const originalLocalStorage = globalThis.localStorage;
afterEach(() => { Object.assign(globalThis, { localStorage: originalLocalStorage }); });

const emptyWorkspace = (): WorkspaceState => ({ accounts: [], documents: [], transactions: [], rules: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina' });

describe('imported workspace persistence', () => {
  it('rolls back every localStorage key when a middle write fails', () => {
    const values = new Map<string, string>([
      ['nafa_ledger_active_workspace_id_v1', 'WS-EXISTING'],
      ['nafa_ledger_workspace_index_v1', '[]'],
      ['nafa_ledger_workspace_v3', '{"existing":true}'],
    ]);
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => { values.delete(key); },
      setItem: (key, value) => {
        if (key === 'nafa_ledger_workspace_index_v1' && value !== '[]') throw new Error('synthetic quota failure');
        values.set(key, value);
      },
    };
    Object.assign(globalThis, { localStorage: storage });
    expect(() => commitImportedWorkspace('WS-IMPORT', emptyWorkspace())).toThrow(/rolled back/);
    expect(values.get('nafa_ledger_active_workspace_id_v1')).toBe('WS-EXISTING');
    expect(values.get('nafa_ledger_workspace_index_v1')).toBe('[]');
    expect(values.get('nafa_ledger_workspace_v3')).toBe('{"existing":true}');
    expect(values.has('nafa_ledger_workspace_v3_WS-IMPORT')).toBe(false);
  });
});
