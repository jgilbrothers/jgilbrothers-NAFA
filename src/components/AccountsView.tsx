import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Layers, 
  Check, 
  Users, 
  User, 
  PlusCircle, 
  Building2, 
  PiggyBank, 
  CreditCard 
} from 'lucide-react';
import { AccountSummary } from '../types';

interface AccountsViewProps {
  accounts: AccountSummary[];
  onAddAccount: (acc: AccountSummary) => void;
  onDeleteAccount: (id: string) => void;
  onToggleJoint: (id: string) => void;
}

export default function AccountsView({
  accounts,
  onAddAccount,
  onDeleteAccount,
  onToggleJoint
}: AccountsViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    account_name: '',
    account_suffix: '',
    account_type: 'checking' as AccountSummary['account_type'],
    institution_name: '',
    current_balance: '',
    is_joint: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.account_name || !formData.account_suffix) return;

    onAddAccount({
      id: `ACC-NEW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      account_name: formData.account_name,
      account_suffix: formData.account_suffix,
      account_type: formData.account_type,
      institution_name: formData.institution_name || 'Generic Bank',
      current_balance: parseFloat(formData.current_balance) || 0,
      available_balance: parseFloat(formData.current_balance) || 0,
      statement_period: 'Current Account Period',
      account_status: 'Active',
      is_joint: formData.is_joint
    });

    setFormData({
      account_name: '',
      account_suffix: '',
      account_type: 'checking',
      institution_name: '',
      current_balance: '',
      is_joint: true
    });
    setShowAddForm(false);
  };

  const getAccountIcon = (type: AccountSummary['account_type']) => {
    switch (type) {
      case 'checking':
        return <Building2 className="h-5 w-5 text-indigo-600" />;
      case 'savings':
        return <PiggyBank className="h-5 w-5 text-emerald-600" />;
      case 'credit_card':
        return <CreditCard className="h-5 w-5 text-rose-600" />;
      default:
        return <Layers className="h-5 w-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6" id="accounts-view-container">

      {/* Header and Toggle Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Financial Accounts Manager</h4>
          <p className="text-xs text-slate-500 mt-0.5">Create account folders for checking, savings, credit cards, or other financial records. These are local categories, not bank logins.</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2 px-3 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Create Account Folder
        </button>
      </div>

      {/* Slide-out or collapsible entry form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="sm:col-span-3 pb-2 border-b border-slate-100 flex items-center justify-between">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Create Account Folder</h5>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account reference Name</label>
            <input 
              type="text"
              required
              placeholder="e.g. Primary Checkings"
              value={formData.account_name}
              onChange={e => setFormData({...formData, account_name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Last 4-Digits suffix</label>
            <input 
              type="text"
              required
              maxLength={4}
              placeholder="e.g. 4321"
              value={formData.account_suffix}
              onChange={e => setFormData({...formData, account_suffix: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Category Type</label>
            <select
              value={formData.account_type}
              onChange={e => setFormData({...formData, account_type: e.target.value as any})}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
            >
              <option value="checking">Checking Account</option>
              <option value="savings">Savings Account</option>
              <option value="credit_card">Credit Card Account</option>
              <option value="loan">Household Loan Ledger</option>
              <option value="investment">Retirement Portfolios</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Brokerage / Institution name</label>
            <input 
              type="text"
              placeholder="e.g. Metro National Bank"
              value={formData.institution_name}
              onChange={e => setFormData({...formData, institution_name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Opening Statement balance</label>
            <input 
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.current_balance}
              onChange={e => setFormData({...formData, current_balance: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={formData.is_joint}
                onChange={e => setFormData({...formData, is_joint: e.target.checked})}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">Joint Asset Status</span>
            </label>
          </div>

          <div className="sm:col-span-3 pt-2 text-right">
            <button 
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-colors cursor-pointer"
            >
              Save Account Folder
            </button>
          </div>
        </form>
      )}

      {/* Account Grid Items Cards Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="accounts-cards-grid">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-350 transition-all">
            
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200 uppercase shrink-0">
                  {getAccountIcon(acc.account_type)}
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-sm">{acc.account_name}</h5>
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                    {acc.institution_name} · <span className="font-mono">Ending *{acc.account_suffix}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer select-none transition-colors border ${
                  acc.is_joint 
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                onClick={() => onToggleJoint(acc.id)}
                title="Click to toggle Custody Type"
                >
                  {acc.is_joint ? (
                    <>
                      <Users className="h-3 w-3" /> Joint
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" /> Individual
                    </>
                  )}
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-400 block mt-1 uppercase">
                  {acc.account_type}
                </span>
              </div>
            </div>

            {/* Balances block */}
            <div className="pt-5 border-t border-slate-100 mt-5 flex items-end justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Statement balance</span>
                <span className="font-mono text-lg font-bold text-slate-900">
                  ${acc.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <button 
                onClick={() => onDeleteAccount(acc.id)}
                className="text-slate-400 hover:text-red-600 transition-colors py-1 pl-2 select-none"
                title="Remove account from balance tracking sheet"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
