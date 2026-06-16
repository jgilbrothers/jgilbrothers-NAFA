import { AccountSummary, DocumentRecord, CategoryRule, Transaction, AuditLog, ChatMessage, WorkspaceProfile } from '../types';
import { ReconciliationItem } from './dataEngine';

const STORAGE_KEY = 'nafa_ledger_workspace_v3';

export interface WorkspaceState {
  accounts: AccountSummary[];
  documents: DocumentRecord[];
  transactions: Transaction[];
  rules: CategoryRule[];
  reconItems: ReconciliationItem[];
  auditLogs: AuditLog[];
  chatLog: ChatMessage[];
  jurisdiction: string;
  profile: WorkspaceProfile | null;
}

/**
 * Saves the entire active workstation state to secure client local state container
 */
export function saveWorkspace(state: WorkspaceState): void {
  try {
    const rawData = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, rawData);
  } catch (err) {
    console.error('Failed to serialize Nafa Workspace into local client storage:', err);
  }
}

/**
 * Restores the active workstation state from client storage
 */
export function loadWorkspace(): WorkspaceState | null {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return null;
    const parsed = JSON.parse(rawData);
    
    // Perform type sanity checkpoints to avoid schema runtime regression mismatch
    if (
      Array.isArray(parsed.accounts) &&
      Array.isArray(parsed.documents) &&
      Array.isArray(parsed.transactions) &&
      Array.isArray(parsed.rules)
    ) {
      return parsed as WorkspaceState;
    }
  } catch (err) {
    console.warn('Stale workspace mapping detected during restore sequence, defaulting to initial seeds:', err);
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
        client_workspace: state.profile?.workspaceName || 'Local Workspace',
        purpose: 'Workspace backup'
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
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear stored ledger metadata:', err);
  }
}

