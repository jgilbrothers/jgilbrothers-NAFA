import React, { useState } from 'react';
import { 
  Trash2, 
  Plus, 
  Sliders, 
  Play, 
  Check, 
  Settings2,
  RefreshCw
} from 'lucide-react';
import { CategoryRule, SYSTEM_CATEGORIES } from '../types';

interface RulesManagerProps {
  rules: CategoryRule[];
  onAddRule: (rule: CategoryRule) => void;
  onDeleteRule: (id: string) => void;
  onSimulateApplyRules: () => void;
}

export default function RulesManager({
  rules,
  onAddRule,
  onDeleteRule,
  onSimulateApplyRules
}: RulesManagerProps) {
  const [keyword, setKeyword] = useState('');
  const [assignedCategory, setAssignedCategory] = useState('Groceries');
  const [isRunning, setIsRunning] = useState(false);
  const [showApplySuccess, setShowApplySuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword) return;

    onAddRule({
      id: `R-NEW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      keyword: keyword.trim().toUpperCase(),
      assigned_category: assignedCategory,
      created_at: new Date().toISOString(),
      hits_count: 0
    });

    setKeyword('');
  };

  const handleApplyRulesRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      onSimulateApplyRules();
      setIsRunning(false);
      setShowApplySuccess(true);
      setTimeout(() => setShowApplySuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6" id="rules-manager-view">
      
      {/* Description */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Automated Category rules manager</h4>
          <p className="text-xs text-slate-500 mt-0.5">Define keyword overrides. When ingested transaction names contain these markers, system routes categories automatically.</p>
        </div>

        <button
          onClick={handleApplyRulesRun}
          disabled={isRunning}
          className="bg-indigo-900 hover:bg-indigo-850 text-white font-bold text-[10px] uppercase py-2 px-3.5 rounded flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 select-none"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Simulating classification...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current text-indigo-300" /> Apply/Test Active Ruleset
            </>
          )}
        </button>
      </div>

      {showApplySuccess && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs p-3 rounded-lg flex items-center gap-2 select-none">
          <Check className="h-4 w-4 text-emerald-600" /> Dynamic category rule testing completed! Rules successfully matched and mapped against matching raw bank logs.
        </div>
      )}

      {/* Grid: Form in left, List in right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Input Form Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Add Keyword Mapping rule</h5>
            
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Row Keyword Match</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. STARBUCKS, YMCA, CONED"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono font-bold uppercase focus:border-indigo-400 outline-hidden"
                />
                <span className="text-[9px] text-slate-400 block mt-0.5 font-sans">
                  Matching is case-insensitive. Partial description matches trigger mapping.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assigned Category Folder</label>
                <select
                  value={assignedCategory}
                  onChange={e => setAssignedCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
                >
                  {SYSTEM_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-colors cursor-pointer text-center"
                >
                  Save Active Keyword Rule
                </button>
              </div>
            </form>

          </div>
        </div>

        {/* Right: Tabular rule registries */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Keyword Mapping Repositories</h5>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="p-3">Matched Keyword</th>
                    <th className="p-3">Assigned Category</th>
                    <th className="p-3">Created Date</th>
                    <th className="p-3">Hits Recorded</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {rules.map((rule) => {
                    const hitsColor = rule.hits_count > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400';

                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 tracking-tight">
                          "{rule.keyword}"
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-50 text-slate-700 text-[11px] font-sans font-semibold px-2 py-0.5 rounded border border-slate-250">
                            {rule.assigned_category}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] text-slate-500">
                          {new Date(rule.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-[11px]">
                          <span className={`${hitsColor}`}>
                            {rule.hits_count} matches
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => onDeleteRule(rule.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors py-1 pl-2"
                            title="Delete mapping rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-slate-400 italic font-sans">
                        No active keyword rules defined. Create one on the left.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
