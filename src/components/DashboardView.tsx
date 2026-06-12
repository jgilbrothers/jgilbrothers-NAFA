import React from 'react';
import { 
  Building2, 
  TrendingUp, 
  FileCheck2, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  CheckCircle,
  Play
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie 
} from 'recharts';
import { AccountSummary, Transaction } from '../types';
import { FinancialAggregates } from '../utils/dataEngine';

interface DashboardViewProps {
  accounts: AccountSummary[];
  transactions: Transaction[];
  aggregates: FinancialAggregates;
  onNavigate: (tab: string) => void;
  unresolvedReviewCount: number;
}

const COLORS = ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#0f766e', '#0d9488', '#0284c7', '#4f46e5', '#3b82f6'];

export default function DashboardView({ 
  accounts, 
  transactions, 
  aggregates, 
  onNavigate,
  unresolvedReviewCount
}: DashboardViewProps) {

  // Process data for the category chart to match Recharts expected format
  const pieData = aggregates.categorySpending.slice(0, 7);

  return (
    <div className="space-y-6" id="dashboard-view-container">
      
      {/* Workflow Wizard Navigation Guidance Bar */}
      <div className="bg-slate-900 text-white rounded-xl shadow-sm p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Active Workflow wizard</h4>
            <div className="flex flex-wrap items-center text-[10px] text-slate-400 font-medium select-none mt-0.5 gap-x-2 gap-y-1">
              <span>Upload Document</span>
              <span className="text-slate-600">→</span>
              <span>Classify</span>
              <span className="text-slate-600">→</span>
              <span>Reconcile Accounts</span>
              <span className="text-slate-600">→</span>
              <span>Categorize Splits</span>
              <span className="text-slate-600">→</span>
              <span>Review Corrections Queue</span>
              <span className="text-slate-600">→</span>
              <span>Generate Reports</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => onNavigate('documents')}
          className="bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold uppercase py-1.5 px-3 rounded text-white flex items-center gap-1.5 transition-all self-start md:self-auto cursor-pointer"
        >
          <Play className="h-3 w-3 fill-current" /> Add Statements
        </button>
      </div>

      {/* Analytical KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="metric-cards-grid">
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Extracted Assets</span>
              <Building2 className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              ${aggregates.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Checking + Savings liquidity values</p>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3">
            <button onClick={() => onNavigate('accounts')} className="text-indigo-600 text-[10px] font-bold uppercase hover:underline text-left">
              Manage accounts &rarr;
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Recorded Liabilities</span>
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-slate-900 mt-2">
              ${aggregates.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Apex Card + Line of Credit balances</p>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3">
            <button onClick={() => onNavigate('accounts')} className="text-indigo-600 text-[10px] font-bold uppercase hover:underline text-left">
              View liabilities &rarr;
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Net Extractable Capital</span>
              <FileCheck2 className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-600 mt-2">
              ${aggregates.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Marital accounts balance difference</p>
          </div>
          <div className="pt-3 border-t border-slate-100 mt-3">
            <span className="text-[10px] font-bold text-slate-500">NC-FAMILY LAW PRESET APPROVED</span>
          </div>
        </div>

        <div className={`rounded-xl shadow-xs p-5 transition-all border flex flex-col justify-between ${
          unresolvedReviewCount > 0 
            ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Reconciliation review items</span>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono tracking-tight mt-2 flex items-center gap-2">
              {unresolvedReviewCount}
              {unresolvedReviewCount > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded animate-pulse">
                  ACTN REQ
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">OCR errors, duplicates, transfer links</p>
          </div>
          <div className="pt-3 border-t border-slate-200 mt-3">
            <button onClick={() => onNavigate('review-queue')} className="text-amber-800 text-[10px] font-bold uppercase hover:underline text-left">
              Resolve Review queues &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Grid containing Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left columns: Category Spending & Income Flow Chart */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Income vs Debits Flow */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              Ingested Cash Balance Flow vs Debt Spending
            </h4>
            <div className="h-64 font-mono text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregates.incomeVsExpense}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [`$${value}`, undefined]} />
                  <Bar dataKey="income" fill="#1e293b" name="Deposited Income" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expense" fill="#64748b" name="Statement Debits" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Core chronological recent activity */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-900" />
                Recent Transaction activities
              </h4>
              <button onClick={() => onNavigate('ledger')} className="text-indigo-600 text-[10px] font-bold hover:underline">
                View Ledger &rarr;
              </button>
            </div>

            <div className="space-y-2">
              {transactions.slice(0, 5).map((tx, idx) => (
                <div key={tx.transaction_id || idx} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition-colors border border-slate-50 text-xs">
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 font-mono">{tx.transaction_date}</span>
                      <span className="bg-slate-100 text-slate-600 font-mono text-[9px] px-1 rounded block truncate max-w-[80px]">
                        *{tx.card_or_account_suffix}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded px-1">
                        {tx.category}
                      </span>
                    </div>
                    <p className="text-slate-500 font-mono text-[11px] mt-1 truncate" title={tx.raw_description}>
                      {tx.raw_description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-mono font-bold ${tx.transaction_type === 'debit' ? 'text-slate-950' : 'text-emerald-700'}`}>
                      {tx.transaction_type === 'debit' ? '-' : '+'}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column: Spending Categorizations Summary & Unclassified warns */}
        <div className="lg:col-span-1 space-y-6">

          {/* Debits distribution charts */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              Debit Categorizations
            </h4>
            
            <div className="h-48 flex items-center justify-center font-mono text-[10px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="55%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, undefined]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">No debits categorized yet.</div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {pieData.map((pt, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-slate-600 truncate">{pt.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-800">${pt.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Alert list */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unclassified Audit Warning Indicator</h5>
              <p className="text-xs text-slate-600 mt-1">
                Outstanding unclassified debit accounts: **{aggregates.unclassifiedTransactionsCount} rows**.
              </p>
            </div>
            
            {aggregates.unclassifiedTransactionsCount > 0 && (
              <div className="bg-white border border-slate-200 p-3 rounded-lg text-[11px] text-slate-700 space-y-2">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.5 rounded">
                  Category Rules Needed
                </span>
                <p>Establishing Keyword Category Rules for common merchants instantly maps all historical records.</p>
                <button
                  onClick={() => onNavigate('rules')}
                  className="text-indigo-600 font-bold hover:underline select-none mt-1 inline-block"
                >
                  Configure Rules Engine &rarr;
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
