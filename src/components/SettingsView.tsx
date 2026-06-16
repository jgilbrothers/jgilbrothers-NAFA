import React, { useEffect, useState } from 'react';
import { WorkspaceProfile } from '../types';
import { 
  Settings, 
  MapPin, 
  Key, 
  Database, 
  Sparkles, 
  Check, 
  RotateCcw,
  BookOpen,
  Download,
  Upload,
  AlertTriangle,
  FileCheck,
  ShieldAlert
} from 'lucide-react';

interface SettingsViewProps {
  onResetDatabase: () => void;
  jurisdiction: string;
  onChangeJurisdiction: (j: string) => void;
  onExportBackup: () => void;
  onImportBackup: (backupState: any) => Promise<boolean>;
  profile: WorkspaceProfile;
  onSaveProfile: (profile: WorkspaceProfile) => void;
  onLoadDemoData: () => void;
}

export default function SettingsView({ 
  onResetDatabase, 
  jurisdiction, 
  onChangeJurisdiction,
  onExportBackup,
  onImportBackup,
  profile,
  onSaveProfile,
  onLoadDemoData
}: SettingsViewProps) {
  const [maskSuff, setMaskSuff] = useState(true);
  const [deepScan, setDeepScan] = useState(false);
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showSeedMsg, setShowSeedMsg] = useState(false);
  const [showImportSuccessMsg, setShowImportSuccessMsg] = useState(false);
  const [importError, setImportError] = useState('');
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<any>(null);
  const [profileDraft, setProfileDraft] = useState(profile);

  useEffect(() => {
    setProfileDraft(profile);
  }, [profile]);

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSavedMsg(true);
    setTimeout(() => {
      setShowSavedMsg(false);
    }, 2500);
  };

  const handleFullReset = () => {
    if (confirm('Reset workspace? This removes local workspace data from this browser unless backed up first.')) {
      onResetDatabase();
      setShowSeedMsg(true);
      setTimeout(() => {
        setShowSeedMsg(false);
      }, 2500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setShowImportSuccessMsg(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Basic structural validation
        if (
          parsed &&
          Array.isArray(parsed.accounts) &&
          Array.isArray(parsed.documents) &&
          Array.isArray(parsed.transactions) &&
          Array.isArray(parsed.rules)
        ) {
          setPendingBackupData(parsed);
          setShowOverwriteWarning(true); // show the beautiful overwrite alert prompt
        } else {
          setImportError('Invalid archive structure. Missing required database tables (accounts, documents, rules, or transactions).');
        }
      } catch (err: any) {
        setImportError('Failed to parse backup JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!pendingBackupData) return;
    const success = await onImportBackup(pendingBackupData);
    if (success) {
      setShowImportSuccessMsg(true);
      setPendingBackupData(null);
      setShowOverwriteWarning(false);
      setTimeout(() => {
        setShowImportSuccessMsg(false);
      }, 4000);
    } else {
      setImportError('Workspace restore was rejected by persistent database engine.');
    }
  };

  return (
    <div className="space-y-6" id="settings-view-container">

      {/* Description headings */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Workspace Settings</h4>
        <p className="text-xs text-slate-500 mt-0.5">Edit your local workspace profile, backups, restore options, reset controls, and sample data.</p>
      </div>

      {showSavedMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2 select-none">
          <Check className="h-4 w-4 text-emerald-600" /> System default configuration parameters saved successfully.
        </div>
      )}

      {showSeedMsg && (
        <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs p-3.5 rounded-xl flex items-center gap-2 select-none">
          <RotateCcw className="h-4 w-4 text-indigo-600" /> Workspace reset. Local financial data was removed from this browser.
        </div>
      )}

      {showImportSuccessMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs p-3.5 rounded-xl flex items-center gap-2 select-none font-sans font-semibold">
          <FileCheck className="h-4 w-4 text-emerald-600" /> Workspace Backup Restored! Mapped accounts, documents, transactions, category rules, and system histories compiled successfully.
        </div>
      )}

      {importError && (
        <div className="bg-rose-50 text-rose-800 border border-rose-200 text-xs p-3.5 rounded-xl flex items-center gap-2 select-none font-sans font-semibold">
          <ShieldAlert className="h-4 w-4 text-rose-600" /> {importError}
        </div>
      )}

      {/* Beautiful warn user before overwrite alert modal/section */}
      {showOverwriteWarning && (
        <div className="bg-amber-50 text-amber-900 border-2 border-amber-300 p-5 rounded-xl space-y-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <h5 className="font-bold text-xs uppercase tracking-wider text-amber-850">Caution: Overwriting Active Workspace</h5>
          </div>
          <p className="text-xs leading-relaxed text-amber-800">
            You are about to restore a workspace backup containing <strong>{pendingBackupData?.transactions?.length} transactions</strong> and <strong>{pendingBackupData?.accounts?.length} accounts</strong>. This will replace all current overrides, split records, and configurations with the imported backup file. This cannot be undone.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={confirmRestore}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase py-2 px-4 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Overwrite and Restore
            </button>
            <button
              onClick={() => {
                setPendingBackupData(null);
                setShowOverwriteWarning(false);
              }}
              className="bg-transparent border border-amber-300 hover:bg-amber-100 text-amber-750 font-bold text-[10px] uppercase py-2 px-4 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { handleSaveConfigs(e); onSaveProfile({ ...profileDraft, lastOpenedAt: new Date().toISOString() }); }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs text-slate-900">
        
        {/* Left Column: Toggles */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Jurisdiction Preset Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <MapPin className="h-4 w-4 text-slate-400" /> Workspace Profile
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="font-bold">Display name<input value={profileDraft.userDisplayName} onChange={e => setProfileDraft({ ...profileDraft, userDisplayName: e.target.value })} className="mt-1 w-full border border-slate-200 rounded p-2 font-medium" /></label>
              <label className="font-bold">Workspace name<input value={profileDraft.workspaceName} onChange={e => setProfileDraft({ ...profileDraft, workspaceName: e.target.value })} className="mt-1 w-full border border-slate-200 rounded p-2 font-medium" /></label>
              <label className="font-bold sm:col-span-2">Case or project name<input value={profileDraft.caseOrProjectName || ''} onChange={e => setProfileDraft({ ...profileDraft, caseOrProjectName: e.target.value })} className="mt-1 w-full border border-slate-200 rounded p-2 font-medium" /></label>
            </div>
            <p className="text-xs text-slate-550 leading-normal">Choose the default jurisdiction label for this local workspace.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 transition-all ${
                jurisdiction.includes('North Carolina')
                  ? 'bg-indigo-50/50 border-indigo-200 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <input 
                  type="radio"
                  name="jurisdiction"
                  checked={jurisdiction.includes('North Carolina')}
                  onChange={() => { onChangeJurisdiction('North Carolina'); setProfileDraft({ ...profileDraft, jurisdiction: 'North Carolina' }); }}
                  className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <div className="min-w-0">
                  <span className="font-bold block">North Carolina</span>
                  <span className="text-[10px] text-slate-400 font-mono">Default workspace jurisdiction</span>
                </div>
              </label>

              <label className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 transition-all ${
                jurisdiction === 'Universal Neutral'
                  ? 'bg-indigo-50/50 border-indigo-200 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}>
                <input 
                  type="radio"
                  name="jurisdiction"
                  checked={jurisdiction === 'Universal Neutral'}
                  onChange={() => { onChangeJurisdiction('Universal Neutral'); setProfileDraft({ ...profileDraft, jurisdiction: 'Universal Neutral' }); }}
                  className="h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <div className="min-w-0">
                  <span className="font-bold block">Universal Neutral</span>
                  <span className="text-[10px] text-slate-400 font-mono">General financial review</span>
                </div>
              </label>
            </div>
          </div>

          {/* Privacy & Masking */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Key className="h-4 w-4 text-slate-400" /> Security & Privacy Masking Configurations
            </h5>

            <div className="space-y-4 pt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={maskSuff}
                  onChange={e => setMaskSuff(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Enforce Account number Suffix Masking</span>
                  <span className="text-slate-400 text-[11px] font-medium block">Masks 16-digit bank logs to show trailing 4 digits suffix on all UI tables. Recommended.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={deepScan}
                  onChange={e => setDeepScan(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Enable AI Deep Analytics Scan</span>
                  <span className="text-slate-400 text-[11px] font-medium block">Performs high depth cross-association models testing in mock chat queries. Requires secondary background parsing.</span>
                </div>
              </label>
            </div>
          </div>

        </div>

        {/* Right Column: Database triggers rest actions */}
        <div className="lg:col-span-1 space-y-4">
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 text-slate-900">
              <Database className="h-4.5 w-4.5 text-slate-400" /> Database Local Memory management
            </h5>
            <p className="text-slate-500 leading-normal font-medium">
              Milestone 6 runs completely in client-side browser storage. Any custom accounts, file classifications, or overrides reside locally in state context.
            </p>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              {/* Local Backup Exporter Trigger Button */}
              <button
                type="button"
                onClick={onExportBackup}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2.5 px-4 rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" /> Export Workspace Backup
              </button>

              {/* Local Restore Importer Trigger Button via standard browser file selector */}
              <div className="relative">
                <label className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] uppercase py-2.5 px-4 rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                  <Upload className="h-3.5 w-3.5 text-indigo-500" /> Restore Workspace Backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[9.5px] text-slate-400 font-mono text-center pt-1 leading-normal border-t border-slate-100 mt-2">
                ⚠️ Workspace backup contains accounts, documents, transactions, categorizations, rules, and settings. 
                <span className="block italic text-slate-400 mt-1 font-sans">
                  This archive is a workspace backup and not a substitute for original bank statements.
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="w-full bg-indigo-700 hover:bg-red-700 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Replace with Sample Demo Data
                </button>
                <span className="text-[9px] text-slate-400 block mt-1.5 text-center font-sans font-medium">
                  Replaces workspace data with sample accounts, statements, transactions, rules, and review items after confirmation.
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button type="button" onClick={handleFullReset} className="w-full bg-red-800 hover:bg-red-700 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset Workspace
                </button>
                <span className="text-[9px] text-slate-400 block mt-1.5 text-center font-sans font-medium">Reset removes local workspace data from this browser unless backed up first.</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-950 text-indigo-100 rounded-xl p-5 border border-indigo-900 space-y-3 select-none">
            <h6 className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Review & Validation Checklist
            </h6>
            <p className="text-[11px] leading-relaxed text-indigo-200">
              NAFA Ledger supports common financial review practices:
            </p>
            <ul className="space-y-1 text-[10px] font-mono text-indigo-300">
              <li>✔ Clear identification of internal transfers.</li>
              <li>✔ Dual validation of paystub net income ratios.</li>
              <li>✔ Granular expense split classification (Essential vs Discretionary values).</li>
            </ul>
          </div>

        </div>

        {/* Bottom Save button */}
        <div className="lg:col-span-3 text-right">
          <button 
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2.5 px-6 rounded transition-colors cursor-pointer"
          >
            Save Workspace Settings
          </button>
        </div>

      </form>

    </div>
  );
}
