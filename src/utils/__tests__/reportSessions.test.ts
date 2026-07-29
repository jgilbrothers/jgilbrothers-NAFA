import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_REPORT_OWNER_KEY, LEGACY_REPORT_SESSIONS_KEY, parseSavedReportSession, reportSessionsKey, resolveReportSessions, validateSavedReportSessions, writeReportSessions, type SavedReportSession } from '../reportSessions';
import { exportProjectArchive, inspectProjectArchive } from '../projectArchive';
import type { WorkspaceState } from '../persistence';

const session = (id: string): SavedReportSession => ({ id, name: id, timestamp: '2026-01-01T00:00:00.000Z', caseTitle: 'Synthetic', caseNumber: 'SYN-1', clientName: 'Synthetic', jurisdiction: 'North Carolina', reportType: 'itemized_ledger', selectedAccounts: [], selectedCategories: [], startDate: '', endDate: '', excludeDuplicates: true, excludeTransfers: true, excludeUnresolved: false, includeCharts: true, includeNarratives: true, appendixMode: 'condensed' });

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null, key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
};

describe('workspace report-session compatibility', () => {
  let storage: Storage;
  beforeEach(() => { storage = memoryStorage(); });

  it('returns scoped sessions for UI and export', () => {
    writeReportSessions('WS-1', [session('A')], storage);
    expect(resolveReportSessions('WS-1', storage)).toEqual([session('A')]);
  });

  it('places the scoped UI collection into a complete archive', async () => {
    writeReportSessions('WS-1', [session('SCOPED-EXPORT')], storage);
    const state: WorkspaceState = { accounts: [], documents: [], transactions: [], rules: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina', reportMetadata: resolveReportSessions('WS-1', storage) };
    expect((await inspectProjectArchive(await exportProjectArchive('WS-1', state))).workspace.reportMetadata).toEqual([session('SCOPED-EXPORT')]);
  });

  it('claims legacy-only sessions once for the visible active workspace', () => {
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('LEGACY')]));
    expect(resolveReportSessions('WS-1', storage)).toEqual([session('LEGACY')]);
    expect(storage.getItem(LEGACY_REPORT_OWNER_KEY)).toBe('WS-1');
    expect(JSON.parse(storage.getItem(reportSessionsKey('WS-1'))!)).toEqual([session('LEGACY')]);
    expect(storage.getItem(LEGACY_REPORT_SESSIONS_KEY)).toBeNull();
  });

  it('places the visible legacy-only collection into a complete archive', async () => {
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('LEGACY-EXPORT')]));
    const state: WorkspaceState = { accounts: [], documents: [], transactions: [], rules: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction: 'North Carolina', reportMetadata: resolveReportSessions('WS-1', storage) };
    expect((await inspectProjectArchive(await exportProjectArchive('WS-1', state))).workspace.reportMetadata).toEqual([session('LEGACY-EXPORT')]);
  });

  it('treats scoped storage as authoritative after migration and never resurrects a deletion', () => {
    writeReportSessions('WS-1', [session('A'), session('B')], storage);
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('B'), session('C')]));
    storage.setItem(LEGACY_REPORT_OWNER_KEY, 'WS-1');
    expect(resolveReportSessions('WS-1', storage).map(item => item.id)).toEqual(['A', 'B']);
    expect(storage.getItem(LEGACY_REPORT_SESSIONS_KEY)).toBeNull();
    writeReportSessions('WS-1', [session('B')], storage);
    expect(resolveReportSessions('WS-1', storage).map(item => item.id)).toEqual(['B']);
    expect(resolveReportSessions('WS-1', storage).map(item => item.id)).toEqual(['B']);
  });

  it('does not attach owned legacy sessions to another workspace', () => {
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('PRIVATE-WS-1')]));
    storage.setItem(LEGACY_REPORT_OWNER_KEY, 'WS-1');
    expect(resolveReportSessions('WS-2', storage)).toEqual([]);
  });

  it('does not overwrite existing scoped sessions with unowned legacy data', () => {
    writeReportSessions('WS-2', [session('SCOPED')], storage);
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('UNKNOWN-OWNER')]));
    expect(resolveReportSessions('WS-2', storage)).toEqual([session('SCOPED')]);
    expect(storage.getItem(LEGACY_REPORT_OWNER_KEY)).toBeNull();
  });

  it('ignores malformed legacy JSON with a controlled warning', () => {
    const warn = vi.fn();
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, '{bad json');
    expect(resolveReportSessions('WS-1', storage, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
  });

  it('migrates valid legacy siblings while warning about malformed records', () => {
    const warn = vi.fn();
    storage.setItem(LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([{ id: 'BROKEN' }, session('VALID')]));
    expect(resolveReportSessions('WS-1', storage, warn)).toEqual([session('VALID')]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[0]'));
    expect(storage.getItem(LEGACY_REPORT_SESSIONS_KEY)).toBeNull();
  });

  it('leaves legacy sessions recoverable when the scoped write fails', () => {
    const values = new Map<string, string>([[LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('RECOVERABLE')])]]);
    const failing: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => { values.delete(key); },
      setItem: (key, value) => {
        if (key === reportSessionsKey('WS-1')) throw new Error('synthetic quota failure');
        values.set(key, value);
      },
    };
    expect(() => resolveReportSessions('WS-1', failing)).toThrow(/synthetic quota failure/);
    expect(values.get(LEGACY_REPORT_SESSIONS_KEY)).toBeTruthy();
    expect(values.has(LEGACY_REPORT_OWNER_KEY)).toBe(false);
  });

  it('rolls back the scoped write when the migration owner marker fails', () => {
    const values = new Map<string, string>([[LEGACY_REPORT_SESSIONS_KEY, JSON.stringify([session('RECOVERABLE')])]]);
    const failing: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => { values.delete(key); },
      setItem: (key, value) => {
        if (key === LEGACY_REPORT_OWNER_KEY) throw new Error('synthetic marker failure');
        values.set(key, value);
      },
    };
    expect(() => resolveReportSessions('WS-1', failing)).toThrow(/synthetic marker failure/);
    expect(values.get(LEGACY_REPORT_SESSIONS_KEY)).toBeTruthy();
    expect(values.has(reportSessionsKey('WS-1'))).toBe(false);
  });

  it('validates every required report-session field and supported enum', () => {
    expect(parseSavedReportSession(session('VALID'))).toEqual(session('VALID'));
    expect(parseSavedReportSession({ id: 'ONLY-ID' })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('NO-ARRAY'), selectedAccounts: undefined })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('BAD-ARRAY'), selectedCategories: [7] })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('BAD-TYPE'), reportType: 'unknown' })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('BAD-MODE'), appendixMode: 'verbose' })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('BAD-DATE'), startDate: 'next week' })).toBeUndefined();
    expect(parseSavedReportSession({ ...session('BAD-TIME'), timestamp: 'never' })).toBeUndefined();
    expect(() => validateSavedReportSessions([{ id: 'ONLY-ID' }])).toThrow(/incomplete or malformed/);
    expect(() => writeReportSessions('WS-1', [{ id: 'ONLY-ID' }], storage)).toThrow(/incomplete or malformed/);
  });

  it('filters malformed scoped siblings so Reports can still load valid sessions', () => {
    const warn = vi.fn();
    storage.setItem(reportSessionsKey('WS-1'), JSON.stringify([{ id: 'ONLY-ID' }, session('VALID')]));
    expect(resolveReportSessions('WS-1', storage, warn)).toEqual([session('VALID')]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ignored'));
  });

  it('deduplicates IDs deterministically using the first complete session', () => {
    expect(writeReportSessions('WS-1', [session('A'), { ...session('A'), name: 'Later duplicate' }], storage)).toEqual([session('A')]);
  });

  it('handles empty legacy storage normally', () => {
    expect(resolveReportSessions('WS-1', storage)).toEqual([]);
  });

  it('restores imported sessions to the workspace-scoped key and reloads them', () => {
    writeReportSessions('WS-IMPORTED', [session('RESTORED'), session('RESTORED')], storage);
    expect(resolveReportSessions('WS-IMPORTED', storage)).toEqual([session('RESTORED')]);
  });
});
