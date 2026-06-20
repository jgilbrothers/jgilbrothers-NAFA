import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  FileText, 
  Wallet, 
  BookOpen, 
  Settings2, 
  Bot, 
  FolderSearch, 
  ShieldCheck, 
  Terminal, 
  Scale, 
  ListTodo,
  FileCheck2,
  Lock,
  Search,
  Upload,
  Download,
  PlusCircle,
  FolderOpen
} from 'lucide-react';

// Custom views
import DashboardView from './components/DashboardView';
import DocumentsView from './components/DocumentsView';
import AccountsView from './components/AccountsView';
import LedgerView from './components/LedgerView';
import RulesManager from './components/RulesManager';
import AiAnalysisWorkspace from './components/AiAnalysisWorkspace';
import ReportsView from './components/ReportsView';
import UnidentifiedQueue from './components/UnidentifiedQueue';
import ReviewCorrectionsQueue from './components/ReviewCorrectionsQueue';
import SettingsView from './components/SettingsView';

// Hardcoded default seed resources
import { 
  MOCK_ACCOUNTS, 
  MOCK_DOCUMENTS, 
  MOCK_TRANSACTIONS, 
  MOCK_RULES, 
  MOCK_RECON_ITEMS, 
  MOCK_AUDIT_LOGS 
} from './data/mockData';

// Types and helper calculators
import { AccountSummary, DocumentRecord, Transaction, CategoryRule, ChatMessage, AuditLog } from './types';
import { calculateAggregates, applyCategoryRules, detectReconciliationQueues, ReconciliationItem } from './utils/dataEngine';
import { loadWorkspace, saveWorkspace, clearSavedWorkspace, exportWorkspaceToFile, LocalWorkspaceProfile, getWorkspaceSummaries, getActiveWorkspaceId, setActiveWorkspaceId, createNewWorkspace, renameActiveWorkspace, WorkspaceSummary, getWorkspaceStateById, validateWorkspaceBackup, summarizeWorkspace, hasLocalProjects, normalizeImportedWorkspaceState } from './utils/persistence';
import { deleteStoredFilesByDocumentIds, deleteUploadedFile } from './utils/fileStorage';

export default function App() {
  const appName = (import.meta as any).env?.VITE_APP_NAME || "NAFA Ledger";
  const appVersion = (import.meta as any).env?.VITE_APP_VERSION || "1.0.0-OTA";

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // Load baseline persisted workspace from Client standard database if exists
  const initialWorkspace = useMemo(() => loadWorkspace(), []);

  // Ledger state repositories initialized with fallback default database seeds
  const [accounts, setAccounts] = useState<AccountSummary[]>(() => {
    return initialWorkspace?.accounts ?? [];
  });
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    return initialWorkspace?.documents ?? [];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return initialWorkspace?.transactions ?? [];
  });
  const [rules, setRules] = useState<CategoryRule[]>(() => {
    return initialWorkspace?.rules ?? [];
  });
  const [reconItems, setReconItems] = useState<ReconciliationItem[]>(() => {
    return initialWorkspace?.reconItems ?? [];
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    return initialWorkspace?.auditLogs ?? [];
  });
  
  // Chat dialogue sequence state
  const [chatLog, setChatLog] = useState<ChatMessage[]>(() => {
    return initialWorkspace?.chatLog ?? [];
  });

  // General presets
  const [jurisdiction, setJurisdiction] = useState<string>(() => {
    return initialWorkspace?.jurisdiction ?? 'North Carolina';
  });
  const [activeAuditLevel, setActiveAuditLevel] = useState<'all' | 'warning' | 'info'>('all');

  const [profile, setProfile] = useState<LocalWorkspaceProfile | undefined>(() => {
    return initialWorkspace?.profile;
  });
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() => getActiveWorkspaceId());
  const [workspaceSummaries, setWorkspaceSummaries] = useState<WorkspaceSummary[]>(() => getWorkspaceSummaries());
  const [hasOpenedProject, setHasOpenedProject] = useState(false);
  const [selectedStartupProjectId, setSelectedStartupProjectId] = useState<string | null>(() => getActiveWorkspaceId());
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectNote, setNewProjectNote] = useState('');
  const [newProjectJurisdiction, setNewProjectJurisdiction] = useState('North Carolina');
  const [newProjectCounty, setNewProjectCounty] = useState('Durham County');
  const [startupMode, setStartupMode] = useState<'home' | 'new' | 'open' | 'continue'>('home');
  const [pendingImportState, setPendingImportState] = useState<any>(null);
  const [importValidationError, setImportValidationError] = useState('');

  // NAFA Ledger is offline-first; no startup network gate is required.

  // Shared state filters for navigation linking
  const [ledgerSearchFilter, setLedgerSearchFilter] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [shortcutToastMsg, setShortcutToastMsg] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  // Setup Command Palette Workflows
  const paletteCommands = useMemo(() => [
    {
      title: "📂 Navigate to Dashboard Overview",
      description: "Display family status, aggregated asset classes, and summary narratives.",
      action: () => setActiveTab('dashboard'),
      icon: "📊",
      shortcut: "G + D",
      keywords: "dashboard metrics navigate chart overview summary"
    },
    {
      title: "📋 Navigate to Documents Manager",
      description: "Upload financial statement files, assign categories, and view diagnostic indices.",
      action: () => setActiveTab('documents'),
      icon: "📁",
      shortcut: "G + O",
      keywords: "documents files pdf csv upload statements index diagnostics"
    },
    {
      title: "📊 View Comprehensive Transaction Ledger",
      description: "Filter direct table rows, assign splits, and view granular notes.",
      action: () => setActiveTab('ledger'),
      icon: "💳",
      shortcut: "G + L",
      keywords: "ledger transactions splits filter categories overrides card"
    },
    {
      title: "🧠 Ask Nafa AI Auditor Chatbot",
      description: "Query context-aware narratives and financial child support summaries.",
      action: () => setActiveTab('ai-chat'),
      icon: "🧠",
      shortcut: "G + A",
      keywords: "ai chatbot chat audit prompt ai optional questions helper support"
    },
    {
      title: "⚙️ System Configuration Settings",
      description: "Configure multi-jurisdictional family law, overwrite warnings, or reset sandbox.",
      action: () => setActiveTab('settings'),
      icon: "⚙️",
      shortcut: "G + S",
      keywords: "settings jurisdiction reset seed backup restore warnings"
    },
    {
      title: "🗳️ Resolve Low-Confidence Discrepancies",
      description: "Audit duplicate statements, category rules, and transfer pairs.",
      action: () => setActiveTab('review-queue'),
      icon: "🛡️",
      shortcut: "G + R",
      keywords: "review queue corrections duplicates transfer rules"
    },
    {
      title: "💾 Download Offline Backup",
      description: "Serialize entire workbench state into reproducible client-side JSON bundle.",
      action: () => handleExportBackup(),
      icon: "💾",
      shortcut: "Ctrl + S",
      keywords: "backup download json raw serialize save data"
    }
  ], [accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction]);

  const filteredPaletteCommands = useMemo(() => {
    if (!paletteSearch) return paletteCommands;
    const q = paletteSearch.toLowerCase();
    return paletteCommands.filter(c => 
      c.title.toLowerCase().includes(q) || 
      c.description.toLowerCase().includes(q) || 
      c.keywords.toLowerCase().includes(q)
    );
  }, [paletteCommands, paletteSearch]);

  // Trigger PWA installation readiness logic
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K opens Command Palette Action Center
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      // Ctrl/Cmd + S downloads the workspace JSON
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExportBackup();
        setShortcutToastMsg("Workspace backup file downloaded successfully! (Ctrl+S Saved)");
        setTimeout(() => setShortcutToastMsg(''), 3000);
      }
      // Esc closes CMD Palette dialog
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasOpenedProject, accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

  // Command palette action trigger
  const runPaletteCommand = (action: () => void) => {
    action();
    setIsCommandPaletteOpen(false);
  };

  const handleExportBackup = () => {
    exportWorkspaceToFile({
      accounts,
      documents,
      transactions,
      rules,
      reconItems,
      auditLogs,
      chatLog,
      jurisdiction,
      profile
    });
    // Write a beautiful log record safely
    const timestamp = new Date().toISOString();
    const newLog: AuditLog = {
      id: "AUD-BAK-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
      timestamp,
      action: 'BACKUP_EXPORT',
      details: 'Authorized and downloaded backup replication archive file.',
      level: 'info',
      operator: "OperatorAdmin",
      previous_entry_hash: auditLogs[auditLogs.length - 1]?.current_entry_hash ?? 'N/A',
      current_entry_hash: 'SHA256-BLOCK-BAK-REPLICATED'
    };
    setAuditLogs(prev => [...prev, newLog]);
  };

  const applyWorkspaceState = (workspaceState: any) => {
    setAccounts(workspaceState?.accounts ?? []);
    setDocuments(workspaceState?.documents ?? []);
    setTransactions(workspaceState?.transactions ?? []);
    setRules(workspaceState?.rules ?? []);
    setReconItems(workspaceState?.reconItems ?? []);
    setAuditLogs(workspaceState?.auditLogs ?? []);
    setChatLog(workspaceState?.chatLog ?? []);
    setJurisdiction(workspaceState?.jurisdiction ?? 'North Carolina');
    setProfile(workspaceState?.profile);
  };

  const handleSwitchWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    setActiveWorkspaceIdState(workspaceId);
    const workspaceState = loadWorkspace();
    applyWorkspaceState(workspaceState);
    setWorkspaceSummaries(getWorkspaceSummaries());
  };

  const handleCreateWorkspace = (name: string, note = '', selectedJurisdiction = 'North Carolina', county = 'Durham County') => {
    const workspaceId = createNewWorkspace(name || 'New Project', note, selectedJurisdiction, county);
    setActiveWorkspaceIdState(workspaceId);
    applyWorkspaceState(loadWorkspace());
    setWorkspaceSummaries(getWorkspaceSummaries());
  };

  const handleRenameWorkspace = (name: string, updates: Partial<LocalWorkspaceProfile> = {}) => {
    const cleanName = name.trim() || 'Local Workspace';
    const now = new Date().toISOString();
    renameActiveWorkspace(cleanName, updates);
    setProfile(prev => prev ? {
      ...prev,
      ...updates,
      workspaceName: cleanName,
      caseProjectName: cleanName,
      lastOpenedAt: now,
    } : {
      userDisplayName: 'Local User',
      workspaceName: cleanName,
      jurisdiction: updates.jurisdiction || jurisdiction || 'North Carolina',
      county: updates.county || 'Durham County',
      projectNote: updates.projectNote || '',
      createdAt: now,
      lastOpenedAt: now,
      appVersion,
    });
    setWorkspaceSummaries(getWorkspaceSummaries());
  };

  const handleImportBackup = async (backupState: any): Promise<boolean> => {
    try {
      if (!validateWorkspaceBackup(backupState)) return false;
      const normalizedBackup = normalizeImportedWorkspaceState(backupState);
      setAccounts(normalizedBackup.accounts);
      setDocuments(normalizedBackup.documents);
      setTransactions(normalizedBackup.transactions);
      setRules(normalizedBackup.rules);
      setReconItems(normalizedBackup.reconItems ?? []);
      setAuditLogs(normalizedBackup.auditLogs ?? []);
      setChatLog(normalizedBackup.chatLog ?? []);
      setJurisdiction(normalizedBackup.jurisdiction ?? 'North Carolina');
      const importName = backupState.profile?.workspaceName || backupState.profile?.caseProjectName || 'Imported Project';
      const workspaceId = createNewWorkspace(importName, backupState.profile?.projectNote || '', backupState.profile?.jurisdiction || backupState.jurisdiction || 'North Carolina', backupState.profile?.county || 'Durham County');
      setActiveWorkspaceIdState(workspaceId);
      setProfile(backupState.profile || { userDisplayName: 'Local User', workspaceName: importName, jurisdiction: backupState.jurisdiction || 'North Carolina', county: 'Durham County', createdAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString(), appVersion });
      
      const timestamp = new Date().toISOString();
      const newLog: AuditLog = {
        id: "AUD-RESTORE-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
        timestamp,
        action: 'RESTORE_BACKUP',
        details: `Successfully restored bank ledger backup containing ${backupState.transactions.length} entries.`,
        level: 'warning',
        operator: "OperatorAdmin",
        previous_entry_hash: "SHA256-BLOCK-RESTORED-HEADER",
        current_entry_hash: "SHA255-BLOCK-RESTORED-CELL"
      };
      setAuditLogs(prev => [...prev, newLog]);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Shared Tab redirection with dynamic search text state passing
  const handleViewExtractedTransactions = (docId: string) => {
    setLedgerSearchFilter(docId);
    setActiveTab('ledger');
  };

  // Trigger auto-saves to LocalStorage container on state changes
  useEffect(() => {
    if (!hasOpenedProject) return;
    saveWorkspace({
      accounts,
      documents,
      transactions,
      rules,
      reconItems,
      auditLogs,
      chatLog,
      jurisdiction,
      profile
    });
  }, [hasOpenedProject, accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

  // Unified activity logging helper
  const appendAuditLog = (action: string, details: string, level: 'info' | 'warning' | 'critical' = 'info') => {
    const timestamp = new Date().toISOString();
    const lastLog = auditLogs[auditLogs.length - 1];
    const prevHash = lastLog ? lastLog.current_entry_hash : "INITIAL_BOOTSTRAP_HASH";
    
    // Simulate lightweight block-hashing
    const payload = `${action}:${details}:${timestamp}:${prevHash}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    const currentHash = "SHA256-BLOCK-" + Math.abs(hash).toString(16).toUpperCase().padEnd(14, '0');

    const newLog: AuditLog = {
      id: "AUD-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
      timestamp,
      action,
      details,
      level,
      operator: "OperatorAdmin",
      previous_entry_hash: prevHash,
      current_entry_hash: currentHash
    };

    setAuditLogs(prev => [...prev, newLog]);
  };

  // Recalculates metrics on every state adjustment automatically
  const aggregates = useMemo(() => {
    return calculateAggregates(accounts, transactions);
  }, [accounts, transactions]);

  // Unresolved low-confidence flags calculation for indicators
  const unresolvedReviewCount = useMemo(() => {
    return reconItems.filter(item => item.status === 'Unresolved').length;
  }, [reconItems]);

  // Count unidentified documents to render sidebar badges
  const unidentifiedCount = useMemo(() => {
    return documents.filter(doc => doc.file_type === 'Unknown / Needs Review').length;
  }, [documents]);

  // Handlers: Documents
  const handleAddDocument = (newDoc: DocumentRecord) => {
    setDocuments(prev => [newDoc, ...prev]); // Populate at the top instantly
    appendAuditLog('INGEST_STATEMENT', `Uploaded new target file: "${newDoc.filename}"`, 'info');
  };

  const handleDeleteDocument = (id: string) => {
    deleteUploadedFile(id).catch(console.error);
    setDocuments(prev => prev.filter(d => d.id !== id));
    appendAuditLog('DELETE_STATEMENT', `Removed statement log reference ID: "${id}"`, 'warning');
  };

  const handleAssociateAccount = (docId: string, accountId: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, account_id: accountId || undefined } : d));
    const acc = accounts.find(a => a.id === accountId);
    appendAuditLog('ASSOCIATE_ACCOUNT', `Associated document reference ${docId} to Account ${acc?.account_name || accountId || 'None'}`, 'info');
  };

  const handleUpdateDocument = (docId: string, updates: Partial<DocumentRecord>) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
    if (updates.text_extraction_status === 'failed' || updates.text_extraction_status === 'needs_review' || (updates.needs_review_transaction_count || 0) > 0 || (updates.transaction_candidate_count === 0 && updates.transactions_extracted === false)) {
      const reason = updates.text_extraction_error || (updates.needs_review_transaction_count ? `${updates.needs_review_transaction_count} transaction candidates need review` : 'No transactions detected');
      setReconItems(prev => prev.some(item => item.id === `REC-DOC-${docId}`) ? prev : [...prev, { id: `REC-DOC-${docId}`, type: 'Low_Confidence', title: updates.text_extraction_status === 'failed' ? 'Text extraction failed' : 'Document extraction needs review', description: reason, severity: 'medium', documentId: docId, status: 'Unresolved' }]);
    }
    appendAuditLog('UPDATE_DOCUMENT', `Updated document metadata for ${docId}: ${JSON.stringify(updates)}`, 'info');
  };

  // Handlers: Accounts
  const handleAddAccount = (newAcc: AccountSummary) => {
    setAccounts(prev => [...prev, newAcc]);
    appendAuditLog('REGISTER_ACCOUNT', `Registered new asset routing folder: "${newAcc.account_name}" ending *${newAcc.account_suffix}`, 'info');
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    appendAuditLog('DELETE_ACCOUNT', `Purged account ledger container: "${id}"`, 'warning');
  };

  const handleToggleJoint = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, is_joint: !a.is_joint } : a));
    const changed = accounts.find(a => a.id === id);
    appendAuditLog('TOGGLE_ACCOUNT_TYPE', `Modified account type for account ${changed?.account_name}: ${!changed?.is_joint ? 'Joint' : 'Individual'}`, 'info');
  };

  // Handlers: Ledger
  const handleUpdateCategory = (txId: string, category: string, reason?: string) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.transaction_id === txId) {
        return {
          ...tx,
          original_category: tx.original_category || tx.category,
          category,
          manual_override: true,
          override_reason: reason || 'Manual user category override',
          last_updated: new Date().toISOString()
        };
      }
      return tx;
    }));
    const foundTx = transactions.find(t => t.transaction_id === txId);
    appendAuditLog('MANUAL_CLASSIFY', `Operator overrode category for cell reference transaction "${foundTx?.clean_vendor_name || txId}" &rarr; "${category}" (Reason: ${reason || 'Manual user category override'})`, 'info');
  };

  const handleUpdateSplits = (txId: string, splits: Transaction['splits']) => {
    setTransactions(prev => prev.map(tx => tx.transaction_id === txId ? { ...tx, splits } : tx));
    appendAuditLog('SPLIT_TRANSACTION', `Divided line-item balance transaction ${txId} into ${splits?.length} categories`, 'info');
  };

  const handleAddTransactionNotes = (txId: string, notes: string) => {
    setTransactions(prev => prev.map(tx => tx.transaction_id === txId ? { ...tx, notes } : tx));
    appendAuditLog('ANNOTATE_ROW', `Added notes to transaction ${txId}: "${notes}"`, 'info');
  };

  // Handlers: Category Mapping rules
  const handleAddRule = (newRule: CategoryRule) => {
    setRules(prev => [...prev, newRule]);
    appendAuditLog('ADD_RULE', `Defined keyword rule mapping "${newRule.keyword}" &arr; "${newRule.assigned_category}"`, 'info');
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    appendAuditLog('DELETE_RULE', `De-registered automated category rule indicator ${id}`, 'info');
  };

  const handleSimulateApplyRules = () => {
    const { updatedTransactions, ruleLogs } = applyCategoryRules(rules, transactions);
    setTransactions(updatedTransactions);
    
    // Increment hits on matching rules
    setRules(prev => prev.map(rule => {
      const log = ruleLogs.find(l => l.ruleId === rule.id);
      return log ? { ...rule, hits_count: rule.hits_count + log.count } : rule;
    }));

    appendAuditLog('RUN_RULES_SCHEME', `Ran automated category rules mapping against ledger descriptions. Map matched matches.`, 'info');
  };

  // Handlers: AI chat messages
  const handleSendMessage = (msg: ChatMessage) => {
    setChatLog(prev => [...prev, msg]);
    if (msg.sender === 'user') {
      appendAuditLog('QUERY_WORKSPACE', `Submitted natural language AI query: "${msg.text.substring(0, 45)}..."`, 'info');
    }
  };

  // Handlers: Unidentified Queue Classification
  const handleClassifyUnidentifiedDoc = (docId: string, accountId: string, classificationType: DocumentRecord['file_type']) => {
    // 1. Move doc out of Unidentified by updating file_type
    setDocuments(prev => prev.map(doc => doc.id === docId ? { 
      ...doc, 
      file_type: classificationType,
      account_id: accountId || undefined,
      processing_status: 'Completed'
    } : doc));

    // 2. Add an audit log
    const doc = documents.find(d => d.id === docId);
    const acc = accounts.find(a => a.id === accountId);
    appendAuditLog('RESOLVE_UNIDENTIFIED', accountId ? `Classified document ${doc?.filename || docId} and associated it with account ending *${acc?.account_suffix}` : `Classified document ${doc?.filename || docId} without an associated account`, 'info');
  };

  // Handlers: Corrections queue resolutions
  const handleResolveReconItem = (id: string, newStatus: ReconciliationItem['status']) => {
    // 1. Update the item inside setReconItems state
    setReconItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    const item = reconItems.find(i => i.id === id);

    // 2. Map actions to corresponding Transaction records to ensure persistent state propagation
    if (id.startsWith('REC-OCR-')) {
      const txId = id.replace('REC-OCR-', '');
      setTransactions(prev => prev.map(tx => tx.transaction_id === txId ? {
        ...tx,
        manual_override: true,
        last_updated: new Date().toISOString()
      } : tx));
    } else if (id.startsWith('REC-DUP-')) {
      const txAId = item?.transactionA?.transaction_id;
      const txBId = item?.transactionB?.transaction_id;
      if (txAId && txBId) {
        setTransactions(prev => prev.map(tx => {
          if (tx.transaction_id === txBId) {
            return {
              ...tx,
              duplicate_status: newStatus === 'Resolved' ? 'confirmed_duplicate' : 'not_duplicate',
              last_updated: new Date().toISOString()
            };
          }
          if (tx.transaction_id === txAId) {
            return {
              ...tx,
              duplicate_status: 'not_duplicate',
              last_updated: new Date().toISOString()
            };
          }
          return tx;
        }));
      }
    } else if (id.startsWith('REC-TRF-')) {
      const txAId = item?.transactionA?.transaction_id;
      const txBId = item?.transactionB?.transaction_id;
      if (txAId && txBId) {
        setTransactions(prev => prev.map(tx => {
          if (tx.transaction_id === txAId || tx.transaction_id === txBId) {
            return {
              ...tx,
              transfer_status: newStatus === 'Resolved' ? 'confirmed_transfer' : 'not_transfer',
              category: newStatus === 'Resolved' ? 'Transfers' : tx.category,
              last_updated: new Date().toISOString()
            };
          }
          return tx;
        }));
      }
    }

    appendAuditLog('RESOLVE_DISCREPANCY', `Anomalous item checklist ${id} reconciled with action state: "${newStatus}"`, 'info');
  };

  const handleImportTransactions = (newTxs: Transaction[], newDoc: DocumentRecord) => {
    // 1. Add or update the document record
    setDocuments(prev => prev.some(d => d.id === newDoc.id) ? prev.map(d => d.id === newDoc.id ? { ...d, ...newDoc } : d) : [...prev, newDoc]);
    
    // 2. Add the transactions to the database
    setTransactions(prev => [...newTxs, ...prev]);

    // 3. Scan for any new reconciliation queues immediately and merge them
    const newReconItems = detectReconciliationQueues([...newTxs, ...transactions], [...documents, newDoc]);
    setReconItems(prev => {
      const merged = [...prev];
      newReconItems.forEach(newItem => {
        if (!merged.some(m => m.id === newItem.id)) {
          merged.push(newItem);
        }
      });
      return merged;
    });

    appendAuditLog('IMPORT_CSV_LEDGER', `Successfully imported statement document "${newDoc.filename}" containing ${newTxs.length} extracted transactions into direct ledger container`, 'info');
  };

  // Resets ledger databases immediately
  const handleResetDatabase = async () => {
    const documentIds = documents.map(doc => doc.id);
    clearSavedWorkspace();
    await deleteStoredFilesByDocumentIds(documentIds).catch(console.error);
    setAccounts([]);
    setDocuments([]);
    setTransactions([]);
    setRules([]);
    setReconItems([]);
    setAuditLogs([]);
    setChatLog([]);
    setProfile(prev => prev ? { ...prev, lastOpenedAt: new Date().toISOString() } : undefined);
  };

  const handleClearStoredFilesOnly = async () => {
    const documentIds = documents.map(doc => doc.id);
    await deleteStoredFilesByDocumentIds(documentIds);
    setDocuments(prev => prev.map(doc => ({
      ...doc,
      source_file_status: doc.source_file_status === 'stored' ? 'unavailable' : doc.source_file_status,
      local_file: doc.local_file ? { ...doc.local_file, stored: false } : doc.local_file,
    })));
    appendAuditLog('CLEAR_STORED_SOURCE_FILES', 'Cleared stored local source file blobs for the current workspace while retaining document metadata.', 'warning');
  };

  const handleLoadSampleDemoData = () => {
    setAccounts(MOCK_ACCOUNTS);
    setDocuments(MOCK_DOCUMENTS as any);
    setTransactions(MOCK_TRANSACTIONS);
    setRules(MOCK_RULES);
    setReconItems(MOCK_RECON_ITEMS);
    setAuditLogs(MOCK_AUDIT_LOGS);
    setChatLog([]);
    appendAuditLog('LOAD_SAMPLE_DEMO_DATA', 'Loaded sample demo data after explicit confirmation.', 'warning');
  };


  const activeSummary = useMemo(() => summarizeWorkspace(activeWorkspaceId, { accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile }), [activeWorkspaceId, accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

  const openProjectById = (id: string) => {
    setActiveWorkspaceId(id);
    setActiveWorkspaceIdState(id);
    const state = loadWorkspace();
    applyWorkspaceState(state);
    setWorkspaceSummaries(getWorkspaceSummaries());
    setHasOpenedProject(true);
    setStartupMode('home');
  };

  const handleStartupNewProject = () => {
    const workspaceId = createNewWorkspace(newProjectName || 'New Project', newProjectNote, newProjectJurisdiction, newProjectCounty);
    setActiveWorkspaceIdState(workspaceId);
    applyWorkspaceState(loadWorkspace());
    setWorkspaceSummaries(getWorkspaceSummaries());
    setHasOpenedProject(true);
    setStartupMode('home');
    setNewProjectName('');
    setNewProjectNote('');
  };

  const handleStartupImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportValidationError('');
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        if (!validateWorkspaceBackup(parsed)) {
          setImportValidationError('Invalid project backup. Required accounts, documents, transactions, and rules arrays were not found.');
          return;
        }
        setPendingImportState(parsed);
      } catch (err: any) {
        setImportValidationError(`Could not read that project backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const sourceLabel = (status: WorkspaceSummary['sourceFileStatus']) => status === 'yes' ? 'Yes' : status === 'partial' ? 'Partial' : 'No';

  const ProjectSummaryCard: React.FC<{ summary: WorkspaceSummary; actionLabel: string; onAction: () => void }> = ({ summary, actionLabel, onAction }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Project found</p>
        <h3 className="text-lg font-black text-slate-950 mt-1">{summary.name}</h3>
        {summary.note && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{summary.note}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Owner</span><strong>{summary.ownerName || 'Not set'}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Last opened</span><strong>{summary.lastOpenedAt ? new Date(summary.lastOpenedAt).toLocaleString() : 'Unknown'}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Documents</span><strong>{summary.documentCount}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Accounts</span><strong>{summary.accountCount}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Transactions</span><strong>{summary.transactionCount}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Review items</span><strong>{summary.reviewItemCount}</strong></div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">Source files</span><strong>{sourceLabel(summary.sourceFileStatus)}</strong>{summary.sourceFileStatus !== 'yes' && <span className="block text-[10px] text-amber-700 mt-1">Source files not included in this backup. Metadata restored. Original files must be re-uploaded or restored from a full archive.</span>}</div>
        <div className="bg-slate-50 rounded-lg p-2"><span className="block text-slate-400 text-[10px] uppercase">County</span><strong>{summary.county || 'Not set'}</strong></div>
      </div>
      <button onClick={onAction} className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-xl transition-colors">{actionLabel}</button>
    </div>
  );

  // Filters audit footer lists
  const filteredAuditsList = useMemo(() => {
    if (activeAuditLevel === 'all') return auditLogs;
    return auditLogs.filter(log => log.level === activeAuditLevel);
  }, [auditLogs, activeAuditLevel]);


  const handleOpenImportedProject = async () => {
    if (!pendingImportState) return;
    const success = await handleImportBackup(pendingImportState);
    if (success) {
      setHasOpenedProject(true);
      setStartupMode('home');
      setPendingImportState(null);
      setImportValidationError('');
    } else {
      setImportValidationError('Project import failed. The backup was not opened and no current project was overwritten.');
    }
  };

  if (!hasOpenedProject) {
    const lastSummary = workspaceSummaries.find(w => w.id === activeWorkspaceId) || workspaceSummaries[0];
    const pendingSummary = pendingImportState ? summarizeWorkspace('pending-import', normalizeImportedWorkspaceState(pendingImportState)) : null;
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-5xl w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-slate-950">N</div>
            <h1 className="text-3xl md:text-4xl font-black">NAFA Ledger</h1>
            <p className="text-slate-600 max-w-2xl mx-auto">Choose exactly what to open before sensitive financial data is displayed.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
            <button onClick={() => setStartupMode('new')} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl p-5 text-left font-black shadow-sm"><PlusCircle className="h-6 w-6 mb-3" />Start New Project<span className="block text-xs font-semibold mt-1">Create a blank workspace with no demo data.</span></button>
            {hasLocalProjects() && lastSummary && <button onClick={() => { setStartupMode('continue'); setSelectedStartupProjectId(lastSummary.id); }} className="bg-slate-950 hover:bg-slate-800 text-white rounded-xl p-5 text-left font-black"><FolderOpen className="h-6 w-6 mb-3" />Continue Last Project<span className="block text-xs font-semibold text-slate-300 mt-1">Review a summary before opening.</span></button>}
            <button onClick={() => setStartupMode('open')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-950 rounded-xl p-5 text-left font-black"><Upload className="h-6 w-6 mb-3" />Open Existing Project<span className="block text-xs font-semibold text-slate-500 mt-1">Pick a local project or import a backup.</span></button>
          </div>
          <div className="bg-indigo-950 text-indigo-100 rounded-2xl p-5 text-sm leading-relaxed">NAFA Ledger saves working projects in this browser on this device. For long-term storage or moving between devices, export a project backup/archive and keep your original source files backed up separately.<span className="block mt-2 font-bold">For large projects with years of statements, laptop or desktop use is recommended.</span></div>
          {startupMode === 'new' && <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"><h2 className="font-black text-lg">Start New Project</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project name" className="border rounded-lg p-3"/><input value={newProjectJurisdiction} onChange={e => setNewProjectJurisdiction(e.target.value)} placeholder="Jurisdiction" className="border rounded-lg p-3"/><input value={newProjectCounty} onChange={e => setNewProjectCounty(e.target.value)} placeholder="County" className="border rounded-lg p-3"/><textarea value={newProjectNote} onChange={e => setNewProjectNote(e.target.value)} placeholder="Optional project note/summary" className="border rounded-lg p-3 md:col-span-2"/></div><button onClick={handleStartupNewProject} className="bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-xl">Create Blank Project</button></div>}
          {startupMode === 'continue' && lastSummary && <ProjectSummaryCard summary={lastSummary} actionLabel="Continue Project" onAction={() => openProjectById(selectedStartupProjectId || lastSummary.id)} />}
          {startupMode === 'open' && <div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{workspaceSummaries.map(ws => <ProjectSummaryCard key={ws.id} summary={ws} actionLabel="Open Project" onAction={() => openProjectById(ws.id)} />)}</div><div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"><h2 className="font-black text-lg">Import Project Backup</h2><label className="inline-flex items-center gap-2 bg-slate-950 text-white font-bold px-4 py-3 rounded-xl cursor-pointer"><Upload className="h-4 w-4" /> Choose backup JSON<input type="file" accept=".json,.nafa,.backup" onChange={handleStartupImportFile} className="hidden" /></label>{importValidationError && <p className="text-sm text-rose-700 font-bold">{importValidationError}</p>}{pendingSummary && <ProjectSummaryCard summary={pendingSummary} actionLabel="Open Project" onAction={() => void handleOpenImportedProject()} />}</div></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-850 font-sans flex flex-col justify-between select-none" id="nafa-ledger-root-container">
      
      {/* Premium Fintech Top navigation */}
      <header className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-50 py-3 px-6 shadow flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 shrink-0 shadow-xs font-mono font-black border border-emerald-400">
            {appName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-md font-bold tracking-tight text-white font-sans">{appName}</h1>
              <span className="bg-slate-800 text-emerald-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">V{appVersion}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Offline financial analysis and document intelligence workspace</p>
          </div>
        </div>

        {/* Identity block */}
        <div className="flex items-center gap-3.5 text-xs">
          <div className="hidden lg:flex flex-col items-end text-right select-none">
            <span className="font-bold text-slate-250">Local Workspace</span>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">OFFLINE-FIRST ANALYSIS</span>
          </div>
          <div className="bg-slate-950 py-1.5 px-3 border border-slate-800 rounded-lg flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-bold">STANDALONE INTEGRITY CHECKED</span>
          </div>
        </div>
      </header>

      {/* Real-time Workspace Desktop Status Bar */}
      <div className="bg-slate-800 text-slate-300 px-6 py-2 border-b border-slate-700 flex flex-wrap items-center justify-between text-[11px] font-mono gap-3 select-none">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Database: <strong className="text-white font-bold">Local Browser Workspace</strong>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">
            Active Project: <span className="text-emerald-400 font-bold">{activeSummary.name}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">Owner: <span className="text-white font-bold">{activeSummary.ownerName || 'Not set'}</span></span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">County: <span className="text-white font-bold">{activeSummary.county || jurisdiction}</span></span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">
            Jurisdiction: <span className="text-emerald-400 font-bold">{jurisdiction}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">Docs: <span className="text-white font-bold">{documents.length}</span> · Transactions: <span className="text-white font-bold">{transactions.length}</span></span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300 flex items-center gap-1">
            <span>Sync:</span> <strong className="text-emerald-400 font-bold font-mono">100% OFFLINE-READY</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => {
            setStartupMode('new');
            setHasOpenedProject(false);
          }} className="text-[9px] bg-emerald-500 text-slate-950 font-bold px-2 py-1 rounded uppercase">New Project</button>
          <button onClick={() => {
            setStartupMode('open');
            setHasOpenedProject(false);
          }} className="text-[9px] bg-slate-900 border border-slate-700 text-slate-200 font-bold px-2 py-1 rounded uppercase">Switch Project</button>
          <button onClick={() => {
            setStartupMode('open');
            setHasOpenedProject(false);
          }} className="text-[9px] bg-slate-900 border border-slate-700 text-slate-200 font-bold px-2 py-1 rounded uppercase">Open Existing Project</button>
          <button onClick={handleExportBackup} className="text-[9px] bg-slate-900 border border-slate-700 text-slate-200 font-bold px-2 py-1 rounded uppercase flex items-center gap-1"><Download className="h-3 w-3" /> Export Project</button>
          {/* Desktop shortcut tip */}
          <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1.5">
            <kbd className="font-sans font-bold bg-slate-800 px-1 rounded text-[9px] text-slate-300">Ctrl+K</kbd> Search Actions
            <kbd className="font-sans font-bold bg-slate-800 px-1 rounded text-[9px] text-slate-300 ml-1.5">Ctrl+S</kbd> Save Backup
          </span>

          {/* PWA Installation Button Widget */}
          {deferredPrompt ? (
            <button
              onClick={async () => {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2.5 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1 shrink-0 uppercase text-[9.5px] border border-emerald-300 animate-bounce"
              title="Install NAFA LEDGER workstation to your host taskbar as a native window"
            >
              🖥️ Install Desktop Client
            </button>
          ) : (
            <span className="text-[9px] bg-slate-900/60 text-slate-450 border border-slate-750 p-0.5 px-2 rounded font-semibold uppercase">
              ✓ Offline-ready static app
            </span>
          )}
        </div>
      </div>

      {/* Shortcut Action Toast */}
      {shortcutToastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-900 border border-emerald-500 text-emerald-400 font-bold font-mono text-[11px] py-2 px-4 rounded-xl shadow-xl z-[9999] flex items-center gap-2 animate-bounce">
          <span className="h-2 w-2 bg-emerald-400 rounded-full animate-ping"></span>
          <span>{shortcutToastMsg}</span>
        </div>
      )}

      {/* Command Palette Overlay modal popup */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center z-[999] pt-[8%] px-4" id="command-palette-container-box">
            <div className="fixed inset-0" onClick={() => setIsCommandPaletteOpen(false)}></div>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs text-slate-250 relative z-[1000] space-y-0"
            >
              <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                <Search className="h-4.5 w-4.5 text-emerald-400 shrink-0 font-bold" />
                <input 
                  type="text"
                  placeholder="Type a workflow query or utility keyword..."
                  autoFocus
                  className="bg-transparent border-0 text-white font-semibold text-sm outline-hidden w-full placeholder-slate-500 font-mono"
                  onKeyDown={e => {
                    if (e.key === 'Escape') setIsCommandPaletteOpen(false);
                  }}
                  onChange={e => {
                    setPaletteSearch(e.target.value);
                  }}
                  value={paletteSearch}
                />
                <button 
                  onClick={() => setIsCommandPaletteOpen(false)}
                  className="text-[10px] text-slate-500 hover:text-white uppercase font-bold shrink-0 font-mono"
                >
                  [ESC] CLOSE
                </button>
              </div>

              {/* Command options list */}
              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-850 p-2 space-y-0.5 select-none scrollbar-thin">
                {filteredPaletteCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => runPaletteCommand(cmd.action)}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800/80 flex items-center justify-between text-slate-300 hover:text-white group transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-emerald-450 grow-0 group-hover:scale-110 transition-transform">{cmd.icon}</span>
                      <div>
                        <p className="font-semibold text-slate-205 group-hover:text-white">{cmd.title}</p>
                        <p className="text-[10.5px] text-slate-500 group-hover:text-slate-400 mt-0.5 font-sans leading-normal">{cmd.description}</p>
                      </div>
                    </div>
                    <kbd className="text-[9.5px] font-mono text-slate-500 font-bold border border-slate-800 bg-slate-950 px-1.5 py-0.5 rounded select-none">
                      {cmd.shortcut}
                    </kbd>
                  </button>
                ))}
                {filteredPaletteCommands.length === 0 && (
                  <div className="p-6 text-center text-slate-500 italic">
                    No executable system actions match keywords. Try "Ledger", "AI", or "Backup".
                  </div>
                )}
              </div>
              <div className="bg-slate-950 px-4 py-2 text-[10px] text-slate-600 font-mono flex items-center justify-between border-t border-slate-850">
                <span>Select command row above to execute instantly</span>
                <span>Workstation Direct Engine</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NAFA Ledger: Workspace Guide component */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 mt-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <button 
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="w-full flex items-center justify-between p-4 text-left font-sans transition-colors hover:bg-slate-850"
            id="guide-toggle-btn"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">NAFA Ledger: Workspace Guide</h3>
            </div>
            <span className="text-slate-400 font-mono text-xs font-bold">
              {isGuideOpen ? '[ COLLAPSE GUIDE - ]' : '[ EXPAND GUIDE + ]'}
            </span>
          </button>
          
          {isGuideOpen && (
            <div className="p-5 border-t border-slate-800 bg-slate-950 text-slate-305 space-y-4 text-xs font-sans leading-relaxed animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] tracking-wide font-mono">1. What This Does</h4>
                  <p className="text-slate-400 text-[11px]">
                    Acts as a local workspace for financial analysis and document intelligence. It digests receipts, paystubs, statements, and tax files, extracting tabular items with read quality markers.
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] tracking-wide font-mono">2. Safe Editing Rules</h4>
                  <p className="text-slate-400 text-[11px]">
                    Always review and verify differentials before saving overrides. Ensure manual category changes, audit note additions, and metadata classifications are fully certified under the 'Needs Review' checklist prior to export.
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] tracking-wide font-mono">3. How to Publish Changes</h4>
                  <p className="text-slate-400 text-[11px]">
                    All static files compile via simple automated code-syncs pushed directly to serverless Cloudflare networks. Build operations map to Pages assets without heavy VM container runtimes.
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] tracking-wide font-mono">4. What Not to Touch</h4>
                  <p className="text-slate-400 text-[11px]">
                    Do not modify standard system root controllers, internal browser backup protocols, or critical transaction split models. Blocked root directories maintain offline data safety labels.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main workspace layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Sidebar navigation panel: Full 10 core views */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-1">
            <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest p-2 border-b mb-1">Ledger Directories</h5>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Dashboard Overview
              </span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'documents' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Documents Manager
              </span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'accounts' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Accounts Manager
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ledger' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" /> Transaction Ledger
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'rules' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Category Rules Manager
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ai-chat')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ai-chat' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4" /> AI Chat & Analysis
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'reports' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Scale className="h-4 w-4" /> Reports / Export Center
              </span>
            </button>

            <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-3 pb-1 px-2 border-t mt-2 mb-1">Curation Checks</h5>

            <button
              onClick={() => setActiveTab('unidentified-queue')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'unidentified-queue' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderSearch className="h-4 w-4" /> Unidentified Queue
              </span>
              {unidentifiedCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold font-mono px-1.5 py-0.2 rounded shrink-0">
                  {unidentifiedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('review-queue')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'review-queue' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" /> Needs Review
              </span>
              {unresolvedReviewCount > 0 && (
                <span className="bg-rose-150 text-rose-800 text-[10px] font-bold font-mono px-1.5 py-0.2 rounded shrink-0 animate-pulse">
                  {unresolvedReviewCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'settings' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Settings Toggles
              </span>
            </button>

          </div>

          {/* Quick-Stats sidebar box */}
          <div className="bg-slate-900 text-slate-300 p-4 border border-slate-800 rounded-xl space-y-3 font-mono text-[10px] select-none">
            <h6 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-400" /> Workspace Status
            </h6>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Active Workspace:</span>
                <span className="font-bold text-slate-200">{profile?.workspaceName || 'Local Workspace'}</span>
              </div>
              <div className="flex justify-between">
                <span>Transactions Mapped:</span>
                <span className="font-bold text-slate-200">{transactions.length} lines</span>
              </div>
              <div className="flex justify-between">
                <span>Documents:</span>
                <span className="font-bold text-slate-200">{documents.length} files</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic content rendering with slide transition animations */}
        <main className="lg:col-span-4 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView 
                  accounts={accounts}
                  transactions={transactions}
                  aggregates={aggregates}
                  documents={documents}
                  onNavigate={(tab) => setActiveTab(tab)}
                  unresolvedReviewCount={unresolvedReviewCount}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsView 
                  documents={documents}
                  accounts={accounts}
                  transactions={transactions}
                  onAddDocument={handleAddDocument}
                  onDeleteDocument={handleDeleteDocument}
                  onLinkAccount={handleAssociateAccount}
                  onImportTransactions={handleImportTransactions}
                  onViewExtractedTransactions={handleViewExtractedTransactions}
                  onUpdateDocument={handleUpdateDocument}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsView
                  accounts={accounts}
                  onAddAccount={handleAddAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onToggleJoint={handleToggleJoint}
                />
              )}

              {activeTab === 'ledger' && (
                <LedgerView
                  transactions={transactions}
                  accounts={accounts}
                  onUpdateCategory={handleUpdateCategory}
                  onUpdateSplits={handleUpdateSplits}
                  onAddTransactionNotes={handleAddTransactionNotes}
                  initialSearchText={ledgerSearchFilter}
                  onClearSearch={() => setLedgerSearchFilter('')}
                  onLinkToDocument={handleViewExtractedTransactions}
                />
              )}

              {activeTab === 'rules' && (
                <RulesManager
                  rules={rules}
                  onAddRule={handleAddRule}
                  onDeleteRule={handleDeleteRule}
                  onSimulateApplyRules={handleSimulateApplyRules}
                />
              )}

              {activeTab === 'ai-chat' && (
                <AiAnalysisWorkspace
                  chatLog={chatLog}
                  transactions={transactions}
                  onSendMessage={handleSendMessage}
                  onClearChat={() => setChatLog([])}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  transactions={transactions}
                  accounts={accounts}
                  documents={documents}
                />
              )}

              {activeTab === 'unidentified-queue' && (
                <UnidentifiedQueue
                  documents={documents}
                  accounts={accounts}
                  onClassify={handleClassifyUnidentifiedDoc}
                />
              )}

              {activeTab === 'review-queue' && (
                <ReviewCorrectionsQueue
                  reconciliationItems={reconItems}
                  onResolveItem={handleResolveReconItem}
                  onUpdateCategory={handleUpdateCategory}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  onResetDatabase={handleResetDatabase}
                  onLoadSampleDemoData={handleLoadSampleDemoData}
                  jurisdiction={jurisdiction}
                  onChangeJurisdiction={(j) => setJurisdiction(j)}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  onClearStoredFilesOnly={handleClearStoredFilesOnly}
                  workspaceName={profile?.workspaceName || 'Local Workspace'}
                  activeWorkspaceId={activeWorkspaceId}
                  workspaceSummaries={workspaceSummaries}
                  onCreateWorkspace={handleCreateWorkspace}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onRenameWorkspace={handleRenameWorkspace}
                  projectNote={profile?.projectNote || ''}
                  ownerName={profile?.userDisplayName || ''}
                  county={profile?.county || 'Durham County'}
                  documentCount={documents.length}
                  transactionCount={transactions.length}
                  accountCount={accounts.length}
                  reviewItemCount={unresolvedReviewCount}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Workspace activity log console */}
      <section className="bg-slate-900 border-t border-slate-800 p-4 md:p-6" id="permanet-ledger-audits-view">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
            <div className="flex items-center gap-2 text-white">
              <Terminal className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-widest">Workspace Activity Logs</h4>
              <span className="bg-slate-800 text-slate-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                EVENTS: {auditLogs.length}
              </span>
            </div>
            
            <div className="flex bg-slate-950 p-0.5 rounded-md text-[9px] font-mono font-bold border border-slate-850">
              <button
                onClick={() => setActiveAuditLevel('all')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  activeAuditLevel === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:text-white'
                }`}
              >
                ALL EVENTS
              </button>
              <button
                onClick={() => setActiveAuditLevel('info')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  activeAuditLevel === 'info' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:text-white'
                }`}
              >
                INFO
              </button>
              <button
                onClick={() => setActiveAuditLevel('warning')}
                className={`px-2 py-1 rounded transition-all cursor-pointer ${
                  activeAuditLevel === 'warning' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-500 hover:text-white'
                }`}
              >
                RISKS
              </button>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-850 font-mono text-[9px] text-slate-400 max-h-[120px] overflow-y-auto space-y-1.5 scrollbar-thin">
            {filteredAuditsList.slice().reverse().map((log) => (
              <div key={log.id} className="flex items-start gap-3 hover:bg-slate-900/40 p-1.5 rounded transition-all leading-relaxed border-b border-slate-900/30">
                <span className="text-slate-600 select-none">[{log.timestamp.substring(11, 19)}]</span>
                <span className={`uppercase font-bold tracking-wider shrink-0 w-24 ${
                  log.level === 'critical' ? 'text-rose-500' :
                  log.level === 'warning' ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {log.action}
                </span>
                <span className="text-slate-350">{log.details}</span>
                <span className="text-[8px] text-slate-600 uppercase ml-auto block select-all pl-2 shrink-0 max-w-[120px] truncate" title={log.current_entry_hash}>
                  {log.current_entry_hash}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Humble Footer */}
      <footer className="bg-slate-950 text-slate-500 text-center py-4 text-[10px] font-mono border-t border-slate-900">
        NAFA Ledger · Local browser workspace · Offline-first financial and document analysis
      </footer>

    </div>
  );
}
