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
  UserRound,
  Upload,
  Download,
  RotateCcw
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
import { AccountSummary, DocumentRecord, Transaction, CategoryRule, ChatMessage, AuditLog, WorkspaceProfile } from './types';
import { calculateAggregates, applyCategoryRules, detectReconciliationQueues, ReconciliationItem } from './utils/dataEngine';
import { loadWorkspace, saveWorkspace, clearSavedWorkspace, clearSavedReportSessions, exportWorkspaceToFile } from './utils/persistence';

const EMPTY_PROFILE_DRAFT = {
  userDisplayName: '',
  workspaceName: '',
  caseOrProjectName: '',
  jurisdiction: 'North Carolina'
};

function hasValidWorkspaceProfile(workspace: ReturnType<typeof loadWorkspace>): boolean {
  const profile = workspace?.profile;
  return Boolean(
    profile &&
    typeof profile.userDisplayName === 'string' && profile.userDisplayName.trim() &&
    typeof profile.workspaceName === 'string' && profile.workspaceName.trim() &&
    typeof profile.jurisdiction === 'string' && profile.jurisdiction.trim() &&
    typeof profile.createdAt === 'string' && profile.createdAt.trim() &&
    typeof profile.lastOpenedAt === 'string' && profile.lastOpenedAt.trim() &&
    typeof profile.appVersion === 'string' && profile.appVersion.trim()
  );
}

export default function App() {
  const appName = (import.meta as any).env?.VITE_APP_NAME || "Nafa Ledger";
  const appVersion = (import.meta as any).env?.VITE_APP_VERSION || "1.0.0";

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Load a saved workspace only when it has a valid local profile.
  const initialWorkspace = useMemo(() => {
    const savedWorkspace = loadWorkspace();
    if (!savedWorkspace) return null;

    if (!hasValidWorkspaceProfile(savedWorkspace)) {
      clearSavedWorkspace();
      clearSavedReportSessions();
      return null;
    }

    return savedWorkspace;
  }, []);

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
    return initialWorkspace?.jurisdiction ?? initialWorkspace?.profile?.jurisdiction ?? 'North Carolina';
  });
  const [activeAuditLevel, setActiveAuditLevel] = useState<'all' | 'warning' | 'info'>('all');

  const [profile, setProfile] = useState<WorkspaceProfile | null>(() => {
    if (!initialWorkspace?.profile) return null;
    return { ...initialWorkspace.profile, lastOpenedAt: new Date().toISOString(), appVersion };
  });
  const [profileDraft, setProfileDraft] = useState({
    ...EMPTY_PROFILE_DRAFT,
    userDisplayName: initialWorkspace?.profile?.userDisplayName ?? EMPTY_PROFILE_DRAFT.userDisplayName,
    workspaceName: initialWorkspace?.profile?.workspaceName ?? EMPTY_PROFILE_DRAFT.workspaceName,
    caseOrProjectName: initialWorkspace?.profile?.caseOrProjectName ?? EMPTY_PROFILE_DRAFT.caseOrProjectName,
    jurisdiction: initialWorkspace?.profile?.jurisdiction ?? EMPTY_PROFILE_DRAFT.jurisdiction
  });


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
      description: "Display workspace status, account classes, and summary narratives.",
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
      title: "🧠 Ask Nafa AI Assistant",
      description: "Ask questions about imported transactions and financial summaries.",
      action: () => setActiveTab('ai-chat'),
      icon: "🧠",
      shortcut: "G + A",
      keywords: "ai chatbot chat analysis prompt gemini questions helper support"
    },
    {
      title: "⚙️ System Configuration Settings",
      description: "Configure jurisdiction labels, backups, restore options, and reset warnings.",
      action: () => setActiveTab('settings'),
      icon: "⚙️",
      shortcut: "G + S",
      keywords: "settings jurisdiction reset seed backup restore warnings"
    },
    {
      title: "🗳️ Resolve Review Items",
      description: "Review duplicate statements, category rules, and transfer pairs.",
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
  ], [accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

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
  }, [accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

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
      details: 'Downloaded local workspace backup file.',
      level: 'info',
      operator: "LocalUser",
      previous_entry_hash: auditLogs[auditLogs.length - 1]?.current_entry_hash ?? 'N/A',
      current_entry_hash: 'LOCAL-BACKUP-EXPORTED'
    };
    setAuditLogs(prev => [...prev, newLog]);
  };

  const profileFromBackup = (backupState: any): WorkspaceProfile => {
    const now = new Date().toISOString();
    return backupState.profile ?? {
      userDisplayName: 'Local User',
      workspaceName: backupState.metadata?.client_workspace || 'Restored NAFA Ledger Workspace',
      caseOrProjectName: undefined,
      jurisdiction: backupState.jurisdiction ?? 'North Carolina',
      createdAt: now,
      lastOpenedAt: now,
      appVersion
    };
  };

  const handleImportBackup = async (backupState: any): Promise<boolean> => {
    try {
      setAccounts(backupState.accounts);
      setDocuments(backupState.documents);
      setTransactions(backupState.transactions);
      setRules(backupState.rules);
      setReconItems(backupState.reconItems ?? []);
      setAuditLogs(backupState.auditLogs ?? []);
      setChatLog(backupState.chatLog ?? []);
      const restoredProfile = profileFromBackup(backupState);
      setProfile(restoredProfile);
      setJurisdiction(backupState.jurisdiction ?? restoredProfile.jurisdiction ?? 'North Carolina');
      
      const timestamp = new Date().toISOString();
      const newLog: AuditLog = {
        id: "AUD-RESTORE-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
        timestamp,
        action: 'RESTORE_BACKUP',
        details: `Successfully restored workspace backup containing ${backupState.transactions.length} entries.`,
        level: 'warning',
        operator: "LocalUser",
        previous_entry_hash: "LOCAL-RESTORE-START",
        current_entry_hash: "LOCAL-RESTORE-COMPLETE"
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
  }, [accounts, documents, transactions, rules, reconItems, auditLogs, chatLog, jurisdiction, profile]);

  // Unified activity logging helper
  const appendAuditLog = (action: string, details: string, level: 'info' | 'warning' | 'critical' = 'info') => {
    const timestamp = new Date().toISOString();
    const lastLog = auditLogs[auditLogs.length - 1];
    const prevHash = lastLog ? lastLog.current_entry_hash : "INITIAL_ACTIVITY_MARKER";
    
    // Simulate lightweight integrity marker generation
    const payload = `${action}:${details}:${timestamp}:${prevHash}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    const currentHash = "LOCAL-ACTIVITY-" + Math.abs(hash).toString(16).toUpperCase().padEnd(14, '0');

    const newLog: AuditLog = {
      id: "AUD-" + Math.random().toString(36).substring(2, 7).toUpperCase(),
      timestamp,
      action,
      details,
      level,
      operator: "LocalUser",
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
    return documents.filter(doc => doc.file_type === 'Unidentified').length;
  }, [documents]);

  // Handlers: Documents
  const handleAddDocument = (newDoc: DocumentRecord) => {
    setDocuments(prev => [...prev, newDoc]);
    appendAuditLog('INGEST_STATEMENT', `Uploaded new financial target file: "${newDoc.filename}"`, 'info');
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    appendAuditLog('DELETE_STATEMENT', `Removed statement log reference ID: "${id}"`, 'warning');
  };

  const handleLinkAccount = (docId: string, accountId: string) => {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, account_id: accountId } : d));
    const acc = accounts.find(a => a.id === accountId);
    appendAuditLog('LINK_ACCOUNT', `Mapped Document reference ${docId} to Account ${acc?.account_name || accountId}`, 'info');
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
    appendAuditLog('TOGGLE_ACCOUNT_SCOPE', `Modified account scope for account ${changed?.account_name}: ${!changed?.is_joint ? 'Joint' : 'Individual'}`, 'info');
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
    appendAuditLog('ANNOTATE_ROW', `Added user note to transaction ${txId}: "${notes}"`, 'info');
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
      account_id: accountId,
      processing_status: 'Completed'
    } : doc));

    // 2. Add an audit log
    const doc = documents.find(d => d.id === docId);
    const acc = accounts.find(a => a.id === accountId);
    appendAuditLog('RESOLVE_UNIDENTIFIED', `Manually matched document ${doc?.filename || docId} target to account ending *${acc?.account_suffix}`, 'info');
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
    // 1. Add the document record
    setDocuments(prev => [...prev, newDoc]);
    
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

    appendAuditLog('IMPORT_CSV_LEDGER', `Successfully imported statement document "${newDoc.filename}" containing ${newTxs.length} parsed transactions into direct ledger container`, 'info');
  };

  const handleResetDatabase = () => {
    clearSavedWorkspace();
    clearSavedReportSessions();
    setAccounts([]);
    setDocuments([]);
    setTransactions([]);
    setRules([]);
    setReconItems([]);
    setAuditLogs([]);
    setChatLog([]);
    setProfile(null);
    setProfileDraft({ ...EMPTY_PROFILE_DRAFT });
  };

  const handleLoadDemoData = () => {
    const hasWorkspaceData = accounts.length > 0 || documents.length > 0 || transactions.length > 0 || rules.length > 0;
    const confirmationMessage = hasWorkspaceData
      ? 'This will replace your current workspace data with sample demo data. Export a backup first if you want to preserve your current workspace.'
      : 'Load sample demo data into this empty workspace?';

    if (!confirm(confirmationMessage)) return;

    setAccounts(MOCK_ACCOUNTS);
    setDocuments(MOCK_DOCUMENTS);
    setTransactions(MOCK_TRANSACTIONS);
    setRules(MOCK_RULES);
    setReconItems(MOCK_RECON_ITEMS);
    setAuditLogs(MOCK_AUDIT_LOGS);
    setChatLog([]);
    appendAuditLog('LOAD_DEMO_DATA', 'Replaced workspace data with sample demo data.', 'warning');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const nextProfile: WorkspaceProfile = {
      userDisplayName: profileDraft.userDisplayName.trim(),
      workspaceName: profileDraft.workspaceName.trim(),
      caseOrProjectName: profileDraft.caseOrProjectName.trim() || undefined,
      jurisdiction: profileDraft.jurisdiction,
      createdAt: profile?.createdAt ?? now,
      lastOpenedAt: now,
      appVersion
    };
    setProfile(nextProfile);
    setJurisdiction(nextProfile.jurisdiction);
  };

  // Filters audit footer lists
  const filteredAuditsList = useMemo(() => {
    if (activeAuditLevel === 'all') return auditLogs;
    return auditLogs.filter(log => log.level === activeAuditLevel);
  }, [auditLogs, activeAuditLevel]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <form onSubmit={handleSaveProfile} className="w-full max-w-lg bg-white text-slate-900 rounded-2xl shadow-2xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-emerald-500 rounded-xl flex items-center justify-center"><UserRound className="h-5 w-5 text-slate-950" /></div>
            <div>
              <h1 className="text-xl font-bold">Create your workspace</h1>
              <p className="text-xs text-slate-500">Local-only profile setup. No cloud account or password is created.</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <label className="block font-bold">Display name<input required value={profileDraft.userDisplayName} onChange={e=>setProfileDraft({...profileDraft,userDisplayName:e.target.value})} className="mt-1 w-full border rounded-lg p-2 font-medium" placeholder="Junelle" /></label>
            <label className="block font-bold">Workspace name<input required value={profileDraft.workspaceName} onChange={e=>setProfileDraft({...profileDraft,workspaceName:e.target.value})} className="mt-1 w-full border rounded-lg p-2 font-medium" placeholder="NC Financial Review Workspace" /></label>
            <label className="block font-bold">Case or project name (optional)<input value={profileDraft.caseOrProjectName} onChange={e=>setProfileDraft({...profileDraft,caseOrProjectName:e.target.value})} className="mt-1 w-full border rounded-lg p-2 font-medium" placeholder="Personal review" /></label>
            <label className="block font-bold">Jurisdiction<select value={profileDraft.jurisdiction} onChange={e=>setProfileDraft({...profileDraft,jurisdiction:e.target.value})} className="mt-1 w-full border rounded-lg p-2 font-medium"><option>North Carolina</option><option>Universal Neutral</option></select></label>
          </div>
          <button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-3 text-xs font-bold uppercase">Create local workspace</button>
        </form>
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
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Personal financial review workspace</p>
          </div>
        </div>

        {/* Identity block */}
        <div className="flex items-center gap-3.5 text-xs">
          <div className="hidden lg:flex flex-col items-end text-right select-none">
            <span className="font-bold text-slate-250">{profile.workspaceName}</span>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{profile.caseOrProjectName || `${profile.userDisplayName}'s local workspace`}</span>
          </div>
          <div className="bg-slate-950 py-1.5 px-3 border border-slate-800 rounded-lg flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-bold">LOCAL WORKSPACE READY</span>
          </div>
        </div>
      </header>

      {/* Real-time Workspace Desktop Status Bar */}
      <div className="bg-slate-800 text-slate-300 px-6 py-2 border-b border-slate-700 flex flex-wrap items-center justify-between text-[11px] font-mono gap-3 select-none">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Workspace: <strong className="text-white font-bold">{profile.workspaceName}</strong>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300">
            Jurisdiction: <span className="text-emerald-400 font-bold">{jurisdiction}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-zinc-300 flex items-center gap-1">
            <span>Sync:</span> <strong className="text-emerald-400 font-bold font-mono">100% OFFLINE-READY</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
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
              title="Install NAFA Ledger as a local app window"
            >
              🖥️ Install Desktop Client
            </button>
          ) : (
            <span className="text-[9px] bg-slate-900/60 text-slate-450 border border-slate-750 p-0.5 px-2 rounded font-semibold uppercase">
              ✓ Local Workspace Standard
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
                <ListTodo className="h-4 w-4" /> Review Queue
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
              <Lock className="h-3 w-3 text-emerald-400" /> Workspace Summary
            </h6>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Workspace:</span>
                <span className="font-bold text-slate-200 truncate">{profile.workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span>Transactions Mapped:</span>
                <span className="font-bold text-slate-200">{transactions.length} lines</span>
              </div>
              <div className="flex justify-between">
                <span>Statement links:</span>
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
                  onLinkAccount={handleLinkAccount}
                  onImportTransactions={handleImportTransactions}
                  onViewExtractedTransactions={handleViewExtractedTransactions}
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
                  onNavigate={(tab) => setActiveTab(tab)}
                  onLoadDemoData={handleLoadDemoData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  transactions={transactions}
                  accounts={accounts}
                  documents={documents}
                  onNavigate={(tab) => setActiveTab(tab)}
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
                  jurisdiction={jurisdiction}
                  onChangeJurisdiction={(j) => setJurisdiction(j)}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  profile={profile}
                  onSaveProfile={(next) => { setProfile(next); setJurisdiction(next.jurisdiction); }}
                  onLoadDemoData={handleLoadDemoData}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Workspace activity log terminal console */}
      <section className="bg-slate-900 border-t border-slate-800 p-4 md:p-6" id="permanent-ledger-activity-view">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
            <div className="flex items-center gap-2 text-white">
              <Terminal className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
              <h4 className="text-xs font-bold uppercase tracking-widest">Workspace activity log</h4>
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
                WARNINGS
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
        NAFA Ledger · Local browser workspace · Backup before resetting or switching browsers
      </footer>

    </div>
  );
}
