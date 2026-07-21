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

const parseSessions = (raw: string | null, label: string, warn: (message: string) => void): SavedReportSession[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('stored value is not an array');
    return parsed.filter((item): item is SavedReportSession => {
      const valid = item !== null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0;
      if (!valid) warn(`${label} contains an invalid report session that was ignored.`);
      return valid;
    });
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
  const normalized = deduplicate(sessions.filter((item): item is SavedReportSession => item !== null && typeof item === 'object' && typeof (item as SavedReportSession).id === 'string'));
  storage.setItem(reportSessionsKey(workspaceId), JSON.stringify(normalized));
  return normalized;
}

/**
 * Resolves the same collection for UI and export. Unowned legacy data is
 * claimed only when this workspace has no scoped sessions, matching the old
 * visible fallback without copying the global collection into every project.
 */
export function resolveReportSessions(workspaceId: string, storage: Storage = localStorage, warn: (message: string) => void = console.warn): SavedReportSession[] {
  const scoped = parseSessions(storage.getItem(reportSessionsKey(workspaceId)), 'Workspace report sessions', warn);
  const legacy = parseSessions(storage.getItem(LEGACY_REPORT_SESSIONS_KEY), 'Legacy report sessions', warn);
  const owner = storage.getItem(LEGACY_REPORT_OWNER_KEY);
  if (owner === workspaceId) return writeReportSessions(workspaceId, [...scoped, ...legacy], storage);
  if (!owner && scoped.length === 0 && legacy.length > 0) {
    storage.setItem(LEGACY_REPORT_OWNER_KEY, workspaceId);
    return writeReportSessions(workspaceId, legacy, storage);
  }
  return scoped;
}
