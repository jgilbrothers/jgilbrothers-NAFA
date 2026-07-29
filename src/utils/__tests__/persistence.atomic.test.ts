import { afterEach, describe, expect, it } from 'vitest';
import { commitImportedWorkspace, getWorkspaceStateById, loadWorkspace, parseLocalWorkspaceProfile, type WorkspaceState } from '../persistence';
import type { Transaction } from '../../types';

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

  it('persists the legacy-transaction migration once without changing ledger facts', () => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
    };
    const legacy: Transaction = { transaction_id: 'LEGACY', transaction_date: '2026-01-01', raw_description: 'Synthetic', clean_vendor_name: 'Synthetic', amount: 21, transaction_type: 'debit', processing_method: 'Other', card_or_account_suffix: '0000', category: 'Groceries', is_pending: false };
    const state = { ...emptyWorkspace(), transactions: [legacy] };
    values.set('nafa_ledger_active_workspace_id_v1', 'WS-LEGACY');
    values.set('nafa_ledger_workspace_v3_WS-LEGACY', JSON.stringify(state));
    Object.assign(globalThis, { localStorage: storage });
    const first = loadWorkspace()!;
    expect(first.transactions[0]).toEqual({ ...legacy, verification_status: 'confirmed' });
    const persisted = JSON.parse(values.get('nafa_ledger_workspace_v3_WS-LEGACY')!);
    expect(persisted.transactions[0]).toEqual({ ...legacy, verification_status: 'confirmed' });
    expect(loadWorkspace()!.transactions).toEqual(first.transactions);
  });

  it('uses the canonical profile parser and never returns render-unsafe local profile values', () => {
    const complete = {
      userDisplayName: 'Synthetic User', workspaceName: 'Synthetic Workspace', caseProjectName: '', projectNote: '',
      county: '', jurisdiction: 'North Carolina', createdAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: '2026-01-02T00:00:00.000Z', appVersion: 'test',
    };
    expect(parseLocalWorkspaceProfile(complete)).toEqual(complete);
    expect(parseLocalWorkspaceProfile({ ...complete, workspaceName: { unsafe: true } })).toBeUndefined();
    expect(parseLocalWorkspaceProfile({ ...complete, lastOpenedAt: 'not-a-date' })).toBeUndefined();
    expect(parseLocalWorkspaceProfile({ ...complete, unsupported: 'value' })).toBeUndefined();

    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
    };
    values.set('nafa_ledger_workspace_v3_WS-PROFILE', JSON.stringify({ ...emptyWorkspace(), profile: { ...complete, workspaceName: ['unsafe'] } }));
    Object.assign(globalThis, { localStorage: storage });
    expect(getWorkspaceStateById('WS-PROFILE')?.profile).toMatchObject({ workspaceName: 'New Project', jurisdiction: 'North Carolina' });
  });
});
