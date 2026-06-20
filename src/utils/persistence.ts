import { AccountSummary, DocumentRecord, CategoryRule, Transaction, AuditLog, ChatMessage } from '../types';
import { ReconciliationItem } from './dataEngine';

const STORAGE_KEY = 'nafa_ledger_workspace_v3';
const WORKSPACE_INDEX_KEY = 'nafa_ledger_workspace_index_v1';
const ACTIVE_WORKSPACE_ID_KEY = 'nafa_ledger_active_workspace_id_v1';

export interface WorkspaceSummary {
  id: string;
  name: string;
  ownerName?: string;
  jurisdiction?: string;
  county?: string;
  note?: string;
  lastOpenedAt: string;
  documentCount: number;
  accountCount: number;
  transactionCount: number;
  reviewItemCount: number;
  sourceFileStatus: 'yes' | 'no' | 'partial';
}

const getWorkspaceKey = (id: string) => `nafa_ledger_workspace_v3_${id}`;
const createWorkspaceId = () => `WS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

export interface LocalWorkspaceProfile {
  userDisplayName: string;
  workspaceName: string;
  caseProjectName?: string;
  projectNote?: string;
  county?: string;
  jurisdiction: string;
  createdAt: string;
  lastOpenedAt: string;
  appVersion: string;
}

export interface WorkspaceState {
  accounts: AccountSummary[];
  documents: DocumentRecord[];
  transactions: Transaction[];
  rules: CategoryRule[];
  reconItems: ReconciliationItem[];
  auditLogs: AuditLog[];
  chatLog: ChatMessage[];
  jurisdiction: string;
  profile?: LocalWorkspaceProfile;
}

const getDefaultWorkspaceState = (name = 'New Project', note = '', jurisdiction = 'North Carolina', county = 'Durham County'): WorkspaceState => {
  const now = new Date().toISOString();
  return {
    accounts: [], documents: [], transactions: [], rules: [], reconItems: [], auditLogs: [], chatLog: [], jurisdiction,
    profile: { userDisplayName: 'Local User', workspaceName: name, caseProjectName: name, projectNote: note, county, jurisdiction, createdAt: now, lastOpenedAt: now, appVersion: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0-OTA' },
  };
};

const sourceStatus = (documents: DocumentRecord[]): 'yes' | 'no' | 'partial' => {
  if (documents.length === 0) return 'no';
  const stored = documents.filter(d => d.source_file_status === 'stored' || d.local_file?.stored).length;
  if (stored === documents.length) return 'yes';
  if (stored === 0) return 'no';
  return 'partial';
};

export function summarizeWorkspace(id: string, state: WorkspaceState): WorkspaceSummary {
  const profile = state.profile;
  return {
    id,
    name: profile?.workspaceName || profile?.caseProjectName || 'Local Project',
    ownerName: profile?.userDisplayName,
    jurisdiction: profile?.jurisdiction || state.jurisdiction,
    county: profile?.county,
    note: profile?.projectNote,
    lastOpenedAt: profile?.lastOpenedAt || new Date().toISOString(),
    documentCount: state.documents?.length || 0,
    accountCount: state.accounts?.length || 0,
    transactionCount: state.transactions?.length || 0,
    reviewItemCount: state.reconItems?.filter(i => i.status === 'Unresolved').length ?? state.reconItems?.length ?? 0,
    sourceFileStatus: sourceStatus(state.documents || []),
  };
}

export function validateWorkspaceBackup(parsed: any): boolean {
  return parsed && typeof parsed === 'object' && Array.isArray(parsed.accounts) && Array.isArray(parsed.documents) && Array.isArray(parsed.transactions) && Array.isArray(parsed.rules);
}

export function getWorkspaceStateById(id: string): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(getWorkspaceKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateWorkspaceBackup(parsed) ? parsed as WorkspaceState : null;
  } catch { return null; }
}

export function saveWorkspace(state: WorkspaceState): void {
  try {
    const activeId = getActiveWorkspaceId();
    const now = new Date().toISOString();
    const normalized: WorkspaceState = { ...state, profile: { ...(state.profile || getDefaultWorkspaceState().profile!), workspaceName: state.profile?.workspaceName || 'Local Project', jurisdiction: state.profile?.jurisdiction || state.jurisdiction || 'North Carolina', county: state.profile?.county || 'Durham County', lastOpenedAt: now } };
    const rawData = JSON.stringify(normalized);
    localStorage.setItem(getWorkspaceKey(activeId), rawData);
    localStorage.setItem(STORAGE_KEY, rawData);
    upsertWorkspaceSummary(summarizeWorkspace(activeId, normalized));
  } catch (err) { console.error('Failed to serialize Nafa Workspace into local client storage:', err); }
}

export function loadWorkspace(): WorkspaceState | null {
  try {
    const activeId = getActiveWorkspaceId();
    const rawData = localStorage.getItem(getWorkspaceKey(activeId)) || localStorage.getItem(STORAGE_KEY);
    if (!rawData) return null;
    const parsed = JSON.parse(rawData);
    if (validateWorkspaceBackup(parsed)) {
      const now = new Date().toISOString();
      parsed.profile = { ...(parsed.profile || getDefaultWorkspaceState().profile), workspaceName: parsed.profile?.workspaceName || 'Local Project', jurisdiction: parsed.profile?.jurisdiction || parsed.jurisdiction || 'North Carolina', county: parsed.profile?.county || 'Durham County', lastOpenedAt: now };
      return parsed as WorkspaceState;
    }
  } catch (err) { console.warn('Stale workspace mapping detected during restore sequence:', err); }
  return null;
}

export function exportWorkspaceToFile(state: WorkspaceState): void {
  try {
    const name = (state.profile?.workspaceName || 'nafa-project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nafa-project';
    const backupData = { schema_version: 'nafa-ledger-v3-project-backup', timestamp: new Date().toISOString(), archive_note: 'This backup preserves project data and metadata. Source files stored in browser storage may need to be exported separately until full archive export is available.', archive_manifest: ['workspace.json compatible JSON', 'accounts', 'documents', 'transactions', 'reports metadata when available', 'review items', 'settings'], ...state };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${name}.nafa-backup.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  } catch (err) { console.error('Failed to compile local workspace archive download:', err); }
}

export function clearSavedWorkspace(): void {
  try {
    const activeId = getActiveWorkspaceId();
    const name = getWorkspaceSummaries().find(w => w.id === activeId)?.name || 'Local Project';
    const state = getDefaultWorkspaceState(name);
    localStorage.setItem(getWorkspaceKey(activeId), JSON.stringify(state));
    upsertWorkspaceSummary(summarizeWorkspace(activeId, state));
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) { console.error('Failed to clear stored ledger metadata:', err); }
}

export function getWorkspaceSummaries(): WorkspaceSummary[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((w: any) => ({ documentCount: 0, accountCount: 0, transactionCount: 0, reviewItemCount: 0, sourceFileStatus: 'no', ...w }));
  } catch (err) { console.warn('Unable to read workspace index:', err); }
  return [];
}

export function hasLocalProjects(): boolean { return getWorkspaceSummaries().length > 0 || !!localStorage.getItem(STORAGE_KEY); }

export function getActiveWorkspaceId(): string {
  let id = localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
  if (!id) { id = createWorkspaceId(); localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id); }
  return id;
}

export function setActiveWorkspaceId(id: string): void { localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id); const state = getWorkspaceStateById(id); if (state) upsertWorkspaceSummary(summarizeWorkspace(id, state)); }

export function upsertWorkspaceSummary(summary: WorkspaceSummary): void {
  const summaries = getWorkspaceSummaries().filter(w => w.id !== summary.id);
  localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify([{ ...summary, lastOpenedAt: summary.lastOpenedAt || new Date().toISOString() }, ...summaries]));
}

export function createNewWorkspace(name = 'New Project', note = '', jurisdiction = 'North Carolina', county = 'Durham County'): string {
  const cleanName = name.trim() || 'New Project'; const id = createWorkspaceId(); const state = getDefaultWorkspaceState(cleanName, note, jurisdiction, county);
  localStorage.setItem(getWorkspaceKey(id), JSON.stringify(state)); upsertWorkspaceSummary(summarizeWorkspace(id, state)); localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id); return id;
}

export function renameActiveWorkspace(name: string, updates: Partial<LocalWorkspaceProfile> = {}): void {
  const id = getActiveWorkspaceId(); const current = loadWorkspace() || getDefaultWorkspaceState(name);
  current.profile = { ...(current.profile || getDefaultWorkspaceState(name).profile!), ...updates, workspaceName: name, caseProjectName: name, lastOpenedAt: new Date().toISOString() };
  current.jurisdiction = current.profile.jurisdiction || current.jurisdiction || 'North Carolina';
  localStorage.setItem(getWorkspaceKey(id), JSON.stringify(current)); upsertWorkspaceSummary(summarizeWorkspace(id, current));
}
