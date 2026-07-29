export interface SavedReportSession {
  id: string;
  name: string;
  timestamp: string;
  caseTitle: string;
  caseNumber: string;
  clientName: string;
  jurisdiction: string;
  reportType: string;
  selectedAccounts: string[];
  selectedCategories: string[];
  startDate: string;
  endDate: string;
  excludeDuplicates: boolean;
  excludeTransfers: boolean;
  excludeUnresolved: boolean;
  includeCharts: boolean;
  includeNarratives: boolean;
  appendixMode: 'off' | 'condensed' | 'detailed';
  customNotes?: string;
}

export const LEGACY_REPORT_SESSIONS_KEY = 'nafa_saved_reported_sessions_v1';
export const LEGACY_REPORT_OWNER_KEY = 'nafa_saved_reported_sessions_v1_workspace_owner';
export const reportSessionsKey = (workspaceId: string) => `${LEGACY_REPORT_SESSIONS_KEY}_${workspaceId}`;

const REPORT_TYPES = new Set(['category_spending', 'itemized_ledger', 'asset_holdings']);
const APPENDIX_MODES = new Set(['off', 'condensed', 'detailed']);
const PROHIBITED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isDateValue = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const hasUnsafeKeys = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.keys(value).some(key => PROHIBITED_KEYS.has(key) || hasUnsafeKeys((value as Record<string, unknown>)[key], seen));
};

export function parseSavedReportSession(value: unknown): SavedReportSession | undefined {
  if (!isPlainObject(value) || hasUnsafeKeys(value)) return undefined;
  if (typeof value.id !== 'string' || value.id.length === 0) return undefined;
  if (typeof value.name !== 'string' || value.name.length === 0) return undefined;
  if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) return undefined;
  for (const key of ['caseTitle', 'caseNumber', 'clientName', 'jurisdiction'] as const) {
    if (typeof value[key] !== 'string') return undefined;
  }
  if (typeof value.reportType !== 'string' || !REPORT_TYPES.has(value.reportType)) return undefined;
  if (!isStringArray(value.selectedAccounts) || !isStringArray(value.selectedCategories)) return undefined;
  if (!isDateValue(value.startDate) || !isDateValue(value.endDate)) return undefined;
  for (const key of ['excludeDuplicates', 'excludeTransfers', 'excludeUnresolved', 'includeCharts', 'includeNarratives'] as const) {
    if (typeof value[key] !== 'boolean') return undefined;
  }
  if (typeof value.appendixMode !== 'string' || !APPENDIX_MODES.has(value.appendixMode)) return undefined;
  if (value.customNotes !== undefined && typeof value.customNotes !== 'string') return undefined;
  return value as unknown as SavedReportSession;
}

export function validateSavedReportSessions(value: unknown, label = 'Report sessions'): SavedReportSession[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const sessions = value.map((item, index) => {
    const parsed = parseSavedReportSession(item);
    if (!parsed) throw new Error(`${label}[${index}] is incomplete or malformed.`);
    return parsed;
  });
  return deduplicate(sessions);
}

const parseSessions = (raw: string | null, label: string, warn: (message: string) => void): SavedReportSession[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('stored value is not an array');
    return deduplicate(parsed.flatMap((item, index) => {
      const valid = parseSavedReportSession(item);
      if (!valid) {
        warn(`${label}[${index}] contains an invalid report session that was ignored.`);
        return [];
      }
      return [valid];
    }));
  } catch (error) {
    warn(`${label} could not be read and was ignored: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
};

const deduplicate = (sessions: SavedReportSession[]): SavedReportSession[] => {
  const seen = new Set<string>();
  return sessions.filter(session => {
    if (seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
};

export function writeReportSessions(workspaceId: string, sessions: unknown[], storage: Storage = localStorage): SavedReportSession[] {
  const normalized = validateSavedReportSessions(sessions);
  storage.setItem(reportSessionsKey(workspaceId), JSON.stringify(normalized));
  return normalized;
}

/**
 * Resolves the same collection for UI and export. Unowned legacy data is
 * claimed only when this workspace has no scoped sessions, matching the old
 * visible fallback without copying the global collection into every project.
 */
export function resolveReportSessions(workspaceId: string, storage: Storage = localStorage, warn: (message: string) => void = console.warn): SavedReportSession[] {
  const scopedKey = reportSessionsKey(workspaceId);
  const rawScoped = storage.getItem(scopedKey);
  const scoped = parseSessions(rawScoped, 'Workspace report sessions', warn);
  const legacy = parseSessions(storage.getItem(LEGACY_REPORT_SESSIONS_KEY), 'Legacy report sessions', warn);
  const owner = storage.getItem(LEGACY_REPORT_OWNER_KEY);

  if (owner === workspaceId && rawScoped !== null) {
    storage.removeItem(LEGACY_REPORT_SESSIONS_KEY);
    return scoped;
  }
  if (owner === workspaceId && legacy.length > 0) {
    const migrated = writeReportSessions(workspaceId, legacy, storage);
    storage.removeItem(LEGACY_REPORT_SESSIONS_KEY);
    return migrated;
  }
  if (!owner && scoped.length === 0 && legacy.length > 0) {
    const previousScoped = rawScoped;
    let migrated: SavedReportSession[];
    try {
      migrated = writeReportSessions(workspaceId, legacy, storage);
      storage.setItem(LEGACY_REPORT_OWNER_KEY, workspaceId);
    } catch (error) {
      if (previousScoped === null) storage.removeItem(scopedKey);
      else storage.setItem(scopedKey, previousScoped);
      throw error;
    }
    storage.removeItem(LEGACY_REPORT_SESSIONS_KEY);
    return migrated;
  }
  return scoped;
}
