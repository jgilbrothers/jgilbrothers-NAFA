import { AccountSummary, DocumentRecord, CategoryRule, Transaction, AuditLog, ChatMessage } from '../types';
import { ReconciliationItem } from './dataEngine';

const STORAGE_KEY = 'nafa_ledger_workspace_v3';
const WORKSPACE_INDEX_KEY = 'nafa_ledger_workspace_index_v1';
const ACTIVE_WORKSPACE_ID_KEY = 'nafa_ledger_active_workspace_id_v1';

export interface WorkspaceSummary {
  id: string;
  name: string;
  lastOpenedAt: string;
}

const getWorkspaceKey = (id: string) => `nafa_ledger_workspace_v3_${id}`;
const createWorkspaceId = () => `WS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

const getDefaultWorkspaceState = (name = 'Local Workspace'): WorkspaceState => {
  const now = new Date().toISOString();
  return {
    accounts: [],
    documents: [],
    transactions: [],
    rules: [],
    reconItems: [],
    auditLogs: [],
    chatLog: [],
    jurisdiction: 'North Carolina',
    profile: {
      userDisplayName: 'Local User',
      workspaceName: name,
      jurisdiction: 'North Carolina',
      createdAt: now,
      lastOpenedAt: now,
      appVersion: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0-OTA',
    },
  };
};

export interface LocalWorkspaceProfile {
  userDisplayName: string;
  workspaceName: string;
  caseProjectName?: string;
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

/**
 * Saves the entire active workstation state to secure client local state container
 */
export function saveWorkspace(state: WorkspaceState): void {
  try {
    const activeId = getActiveWorkspaceId();
    const rawData = JSON.stringify(state);
    localStorage.setItem(getWorkspaceKey(activeId), rawData);
    localStorage.setItem(STORAGE_KEY, rawData);
    upsertWorkspaceSummary(activeId, state.profile?.workspaceName || 'Local Workspace');
  } catch (err) {
    console.error('Failed to serialize Nafa Workspace into local client storage:', err);
  }
}

/**
 * Restores the active workstation state from client storage
 */
export function loadWorkspace(): WorkspaceState | null {
  try {
    const activeId = getActiveWorkspaceId();
    const rawData = localStorage.getItem(getWorkspaceKey(activeId)) || localStorage.getItem(STORAGE_KEY);
    if (!rawData) return null;
    const parsed = JSON.parse(rawData);
    
    // Perform type sanity checkpoints to avoid schema runtime regression mismatch
    if (
      Array.isArray(parsed.accounts) &&
      Array.isArray(parsed.documents) &&
      Array.isArray(parsed.transactions) &&
      Array.isArray(parsed.rules)
    ) {
      const now = new Date().toISOString();
      if (!parsed.profile) {
        parsed.profile = {
          userDisplayName: 'Local User',
          workspaceName: 'Local Workspace',
          jurisdiction: parsed.jurisdiction || 'North Carolina',
          createdAt: now,
          lastOpenedAt: now,
          appVersion: (import.meta as any).env?.VITE_APP_VERSION || '1.0.0-OTA',
        };
      } else {
        parsed.profile.lastOpenedAt = now;
      }
      return parsed as WorkspaceState;
    }
  } catch (err) {
    console.warn('Stale workspace mapping detected during restore sequence, starting with an empty workspace:', err);
  }
  return null;
}

/**
 * Validates whether structural fields are correctly preserved in file backups
 */
export function validateWorkspaceBackup(parsed: any): boolean {
  return (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.accounts) &&
    Array.isArray(parsed.documents) &&
    Array.isArray(parsed.transactions) &&
    Array.isArray(parsed.rules)
  );
}

/**
 * Generates an instant ledger backup file for offline local preservation
 */
export function exportWorkspaceToFile(state: WorkspaceState): void {
  try {
    const backupData = {
      schema_version: 'nafa-ledger-v3-backup',
      timestamp: new Date().toISOString(),
      metadata: {
        operator: 'OperatorAdmin',
        client_workspace: 'NAFA-DURHAM-NC',
        purpose: 'Marital asset trace archive'
      },
      ...state
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nafa-ledger-workspace-backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to compile local workspace archive download:', err);
  }
}

/**
 * Clears the storage key to allow clean database resets
 */
export function clearSavedWorkspace(): void {
  try {
    const activeId = getActiveWorkspaceId();
    localStorage.removeItem(getWorkspaceKey(activeId));
    localStorage.setItem(getWorkspaceKey(activeId), JSON.stringify(getDefaultWorkspaceState(getWorkspaceSummaries().find(w => w.id === activeId)?.name || 'Local Workspace')));
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear stored ledger metadata:', err);
  }
}



export function getWorkspaceSummaries(): WorkspaceSummary[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.warn('Unable to read workspace index:', err);
  }
  const id = getActiveWorkspaceId();
  const summary = { id, name: 'Local Workspace', lastOpenedAt: new Date().toISOString() };
  localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify([summary]));
  return [summary];
}

export function getActiveWorkspaceId(): string {
  let id = localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
  if (!id) {
    id = createWorkspaceId();
    localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id);
  }
  return id;
}

export function setActiveWorkspaceId(id: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id);
  const summaryName = getWorkspaceSummaries().find(w => w.id === id)?.name;
  const stored = localStorage.getItem(getWorkspaceKey(id));
  let storedName = '';
  if (stored) {
    try {
      storedName = JSON.parse(stored)?.profile?.workspaceName || '';
    } catch {
      storedName = '';
    }
  }
  upsertWorkspaceSummary(id, summaryName || storedName || 'Local Workspace');
}

export function upsertWorkspaceSummary(id: string, name: string): void {
  const now = new Date().toISOString();
  const summaries = getWorkspaceSummaries().filter(w => w.id !== id);
  summaries.unshift({ id, name, lastOpenedAt: now });
  localStorage.setItem(WORKSPACE_INDEX_KEY, JSON.stringify(summaries));
}

export function createNewWorkspace(name = 'New Workspace'): string {
  const cleanName = name.trim() || 'New Workspace';
  const id = createWorkspaceId();
  const state = getDefaultWorkspaceState(cleanName);
  localStorage.setItem(getWorkspaceKey(id), JSON.stringify(state));
  upsertWorkspaceSummary(id, cleanName);
  localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, id);
  return id;
}

export function renameActiveWorkspace(name: string): void {
  const id = getActiveWorkspaceId();
  const current = loadWorkspace() || getDefaultWorkspaceState(name);
  current.profile = { ...(current.profile || getDefaultWorkspaceState(name).profile!), workspaceName: name, lastOpenedAt: new Date().toISOString() };
  current.jurisdiction = current.jurisdiction || 'North Carolina';
  localStorage.setItem(getWorkspaceKey(id), JSON.stringify(current));
  upsertWorkspaceSummary(id, name);
}
