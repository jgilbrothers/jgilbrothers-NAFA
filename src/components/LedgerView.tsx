import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Percent, 
  Plus, 
  Trash2, 
  Check, 
  CornerDownRight,
  Split,
  Edit2
} from 'lucide-react';
import { Transaction, AccountSummary, SYSTEM_CATEGORIES } from '../types';

interface LedgerViewProps {
  transactions: Transaction[];
  accounts: AccountSummary[];
  onUpdateCategory: (txId: string, category: string, reason?: string) => void;
  onUpdateSplits: (txId: string, splits: Transaction['splits']) => void;
  onAddTransactionNotes: (txId: string, notes: string) => void;
  initialSearchText?: string;
  onClearSearch?: () => void;
  onLinkToDocument?: (docId: string) => void;
}

export default function LedgerView({
  transactions,
  accounts,
  onUpdateCategory,
  onUpdateSplits,
  onAddTransactionNotes,
  initialSearchText,
  onClearSearch,
  onLinkToDocument
}: LedgerViewProps) {
  const [searchText, setSearchText] = useState(initialSearchText || '');
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [isDenseMode, setIsDenseMode] = useState(false);

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // States for active split drawer component on single transaction id
  const [splitTxId, setSplitTxId] = useState<string | null>(null);
  const [tempSplits, setTempSplits] = useState<{ category: string; amount: number }[]>([]);

  // States for editing notes on single transaction inline
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Sync prop filters
  useEffect(() => {
    if (initialSearchText !== undefined) {
      setSearchText(initialSearchText);
      setCurrentPage(1); // Reset page on filter shift
    }
  }, [initialSearchText]);

  // Reset page when queries change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selectedAccount, selectedCategory, selectedType]);

  // 1. Interactive Matching & Filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchText = 
        tx.raw_description.toLowerCase().includes(searchText.toLowerCase()) ||
        tx.clean_vendor_name.toLowerCase().includes(searchText.toLowerCase()) ||
        (tx.notes && tx.notes.toLowerCase().includes(searchText.toLowerCase())) ||
        (tx.source_document_id && tx.source_document_id.toLowerCase().includes(searchText.toLowerCase()));

      const matchAccount = selectedAccount === 'All' || tx.card_or_account_suffix === selectedAccount;
      const matchCategory = selectedCategory === 'All' || tx.category === selectedCategory;
      const matchType = selectedType === 'All' || tx.transaction_type === selectedType;

      return matchText && matchAccount && matchCategory && matchType;
    });
  }, [transactions, searchText, selectedAccount, selectedCategory, selectedType]);

  // Paginated chunk
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(filteredTransactions.length / pageSize);
    return pages > 0 ? pages : 1;
  }, [filteredTransactions.length, pageSize]);

  // Unique Account suffixes derived for filters
  const suffixesList = useMemo(() => {
    const list = new Set<string>();
    transactions.forEach(t => list.add(t.card_or_account_suffix));
    return Array.from(list);
  }, [transactions]);

  // Handle starting Split Transaction flow
  const handleOpenSplit = (tx: Transaction) => {
    setSplitTxId(tx.transaction_id);
    if (tx.splits && tx.splits.length > 0) {
      setTempSplits(tx.splits.map(s => ({ category: s.category, amount: s.amount })));
    } else {
      // Default with half as first slice, let user design of remaining halves
      const half = parseFloat((tx.amount / 2).toFixed(2));
      setTempSplits([
        { category: tx.category || 'Groceries', amount: half },
        { category: 'Miscellaneous', amount: parseFloat((tx.amount - half).toFixed(2)) }
      ]);
    }
  };

  const activeSplitTx = useMemo(() => {
    return transactions.find(t => t.transaction_id === splitTxId) || null;
  }, [transactions, splitTxId]);

  const totalSplitAllocated = useMemo(() => {
    return tempSplits.reduce((sum, s) => sum + s.amount, 0);
  }, [tempSplits]);

  const handleApplySplits = () => {
    if (!splitTxId || !activeSplitTx) return;
    
    // Convert to strict schema TransactionSplit
    const updated = tempSplits.map(s => ({
      category: s.category,
      amount: s.amount,
      percentage: Math.round((s.amount / activeSplitTx.amount) * 100)
    }));

    onUpdateSplits(splitTxId, updated);
    setSplitTxId(null);
  };

  return (
    <div className="space-y-6" id="ledger-view-container">

      {/* Primary search grids and category selectors */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        
        {/* Search */}
        <div className="relative">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search description</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search merchant, notes, document id..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 rounded-md outline-hidden focus:border-indigo-400 font-medium"
            />
          </div>
          {searchText && (
            <button
              onClick={() => {
                setSearchText('');
                if (onClearSearch) onClearSearch();
              }}
              className="absolute right-2.5 top-5.5 text-[10px] font-bold text-slate-400 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Custody Account */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Account Suffix</label>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md outline-hidden font-semibold"
          >
            <option value="All">All Statements</option>
            {suffixesList.map(suf => (
              <option key={suf} value={suf}>Ending *{suf}</option>
            ))}
          </select>
        </div>

        {/* Filter Category */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Categories</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md outline-hidden font-semibold"
          >
            <option value="All">All Categories</option>
            {SYSTEM_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Filter Type Credit/Debit */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Statement Entry Class</label>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 p-2 rounded-md outline-hidden font-semibold"
          >
            <option value="All">All Transactions</option>
            <option value="debit">Debits / Outflows</option>
            <option value="credit">Credits / Income</option>
          </select>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Grid: High capacity tabular Ledger List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Transaction Ledger Database</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">Filter, revise values, and override categories directly in row cells structure.</p>
              </div>
              <div className="flex items-center gap-2 select-none">
                {/* Dense mode switch */}
                <button
                  onClick={() => setIsDenseMode(!isDenseMode)}
                  className={`text-[9.5px] font-bold uppercase py-1 px-2 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isDenseMode 
                      ? 'bg-indigo-950 text-indigo-100 border-indigo-900' 
                      : 'bg-white text-slate-705 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle compact cell density spacing"
                >
                  <SlidersHorizontal className="h-3 w-3" /> {isDenseMode ? 'Dense Mode Active' : 'Compact View'}
                </button>

                <span className="bg-slate-200 text-slate-800 text-[10px] font-mono font-bold px-2 py-1 rounded">
                  {filteredTransactions.length} items
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className={isDenseMode ? "p-2 font-bold" : "p-3 font-bold"}>Date</th>
                    <th className={isDenseMode ? "p-2 font-bold" : "p-3 font-bold"}>Reference / Description</th>
                    <th className={isDenseMode ? "p-2 font-bold" : "p-3 font-bold"}>Amount</th>
                    <th className={isDenseMode ? "p-2 font-bold" : "p-3 font-bold"}>Category Allocation</th>
                    <th className={isDenseMode ? "p-2 text-right font-bold" : "p-3 text-right font-bold"}>Interactive Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTransactions.map((tx) => {
                    const isSplit = tx.splits && tx.splits.length > 0;

                    return (
                      <tr key={tx.transaction_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className={`font-mono text-[11px] text-slate-900 font-semibold ${isDenseMode ? 'p-1.5 align-middle' : 'p-3 align-top'}`}>
                          {tx.transaction_date}
                        </td>
                        <td className={`${isDenseMode ? 'p-1.5 align-middle' : 'p-3 align-top'} max-w-xs`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 text-[11px] font-mono truncate">
                                {tx.clean_vendor_name}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 font-semibold bg-slate-100 border px-1 rounded">
                                *{tx.card_or_account_suffix}
                              </span>
                              {isSplit && (
                                <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-bold tracking-wider px-1 rounded flex items-center gap-0.5">
                                  <Split className="h-2 w-2" /> SPLIT
                                </span>
                              )}
                            </div>
                            
                            {!isDenseMode && (
                              <p className="text-slate-400 font-mono text-[10px] mt-0.5 truncate select-all" title={tx.raw_description}>
                                {tx.raw_description}
                              </p>
                            )}

                            {/* Link from transaction directly back to parent statement document */}
                            {tx.source_document_id && onLinkToDocument && (
                              <button
                                onClick={() => onLinkToDocument(tx.source_document_id!)}
                                className="text-[9px] hover:underline font-mono text-indigo-700 bg-indigo-50/50 border border-indigo-100 hover:bg-indigo-50 hover:border-indigo-250 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 select-all cursor-pointer mt-1 font-semibold"
                                title="Jump directly to parsed source statement"
                              >
                                View Source Document
                              </button>
                            )}

                            {/* Displays split distributions if active */}
                            {isSplit && tx.splits && (
                              <div className="mt-1.5 space-y-1 bg-slate-50 rounded p-1.5 border border-slate-100">
                                {tx.splits.map((split, sIdx) => (
                                  <div key={sIdx} className="flex items-center text-[10px] text-slate-600 gap-1 font-mono">
                                    <CornerDownRight className="h-3 w-3 text-slate-400" />
                                    <span className="font-semibold text-slate-700">{split.category}:</span>
                                    <span>${split.amount.toFixed(2)} ({split.percentage}%)</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Transaction details/notes system */}
                            {!isDenseMode && (
                              <div className="mt-2 flex items-center gap-1">
                                {editingNotesId === tx.transaction_id ? (
                                  <div className="flex items-center gap-1.5 w-full">
                                    <input 
                                      type="text"
                                      value={tempNotes}
                                      placeholder="Add transaction notes..."
                                      onChange={e => setTempNotes(e.target.value)}
                                      className="bg-slate-50 border border-slate-350 p-1 rounded text-[11px] text-slate-950 w-full font-mono outline-hidden"
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          onAddTransactionNotes(tx.transaction_id, tempNotes);
                                          setEditingNotesId(null);
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        onAddTransactionNotes(tx.transaction_id, tempNotes);
                                        setEditingNotesId(null);
                                      }}
                                      className="bg-slate-900 text-white rounded p-1 text-[10px] uppercase font-bold"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] leading-relaxed text-slate-500 italic flex items-center gap-1 select-none">
                                    {tx.notes ? (
                                      <>
                                        <span>Notes: {tx.notes}</span>
                                        <button 
                                          onClick={() => {
                                            setEditingNotesId(tx.transaction_id);
                                            setTempNotes(tx.notes || '');
                                          }} 
                                          className="text-indigo-600 hover:underline inline-block text-[9px] font-bold"
                                        >
                                          [Edit]
                                        </button>
                                      </>
                                    ) : (
                                      <button 
                                        onClick={() => {
                                          setEditingNotesId(tx.transaction_id);
                                          setTempNotes('');
                                        }}
                                        className="text-slate-400 hover:text-indigo-600 font-semibold"
                                      >
                                        + Add transaction notes
                                      </button>
                                    )}
                                  </p>
                                )}

                                {tx.manual_override && (
                                  <div className="mt-1 flex flex-col gap-0.5 text-[9px]">
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-150 rounded-sm px-1 py-0.5 inline-block w-fit">
                                      ⚠️ Category revised: originally "{tx.original_category}"
                                    </span>
                                    {tx.override_reason && (
                                      <span className="text-slate-400 font-mono">Reason: {tx.override_reason}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={isDenseMode ? 'p-1.5 align-middle text-[11px]' : 'p-3 align-top'}>
                          <span className={`font-mono font-bold ${tx.transaction_type === 'debit' ? 'text-slate-950' : 'text-emerald-700'}`}>
                            {tx.transaction_type === 'debit' ? '-' : '+'}${tx.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className={isDenseMode ? 'p-1.5 align-middle' : 'p-3 align-top'}>
                          {isSplit ? (
                            <span className="text-[10px] text-slate-400 italic font-medium">Split Allocation</span>
                          ) : (
                            <select
                              value={tx.category}
                              onChange={e => onUpdateCategory(tx.transaction_id, e.target.value, "Manual category override inside row cells ledger")}
                              className="bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-semibold text-slate-800 outline-hidden focus:border-indigo-400"
                            >
                              {SYSTEM_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className={`text-right ${isDenseMode ? 'p-1.5 align-middle' : 'p-3 align-top'}`}>
                          {tx.transaction_type === 'debit' && (
                            <button
                              onClick={() => handleOpenSplit(tx)}
                              className="text-indigo-600 hover:text-indigo-500 hover:bg-indigo-50 rounded border border-indigo-100 p-1 px-1.5 text-[10px] font-bold uppercase transition-all inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Split className="h-3 w-3" /> Split Row
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-slate-405 italic text-[11px]">
                        No transactions match search criteria. Reset filters or input another keyword query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Performance Oriented Client Side Pagination Indicators */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50 text-[10.5px] font-mono select-none">
                <span className="text-slate-500 font-bold uppercase text-[9.5px]">
                  Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
                </span>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">Rows:</span>
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(parseInt(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border rounded p-0.5 text-[10.5px] font-mono outline-hidden"
                    >
                      <option value="50">50</option>
                      <option value="100">100</option>
                      <option value="250">250</option>
                      <option value="500">500</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-2 py-0.5 border rounded bg-white text-slate-800 font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed uppercase text-[9px]"
                    >
                      Prev
                    </button>
                    <span className="px-1.5 font-bold text-slate-800">Page {currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-2 py-0.5 border rounded bg-white text-slate-800 font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed uppercase text-[9px]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Grid: SPLIT DRAWER / CONTROL PANEL */}
        <div className="lg:col-span-1">
          {activeSplitTx ? (
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 shadow-sm space-y-4 sticky top-6">
              
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                  Interactive Splitting Drawer
                </span>
                <h5 className="font-bold text-slate-900 text-sm mt-1.5">Dividing Row Balance</h5>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{activeSplitTx.clean_vendor_name}</p>
                <p className="text-slate-900 font-mono font-bold text-base mt-2">
                  Total Debit Amount: ${activeSplitTx.amount.toFixed(2)}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Defined Slice Allocations</label>
                
                {tempSplits.map((split, sIdx) => (
                  <div key={sIdx} className="bg-slate-5 p-2 rounded border border-slate-150 space-y-1 text-xs">
                    <div className="flex justify-between items-center gap-2">
                      <select
                        value={split.category}
                        onChange={e => {
                          const next = [...tempSplits];
                          next[sIdx].category = e.target.value;
                          setTempSplits(next);
                        }}
                        className="bg-white border rounded p-1 font-semibold text-slate-800"
                      >
                        {SYSTEM_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <button 
                        onClick={() => {
                          const next = tempSplits.filter((_, i) => i !== sIdx);
                          setTempSplits(next);
                        }}
                        className="text-slate-450 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-slate-400">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={split.amount}
                        onChange={e => {
                          const next = [...tempSplits];
                          next[sIdx].amount = parseFloat(e.target.value) || 0;
                          setTempSplits(next);
                        }}
                        className="w-full bg-white border rounded p-1 text-slate-950 font-mono font-bold"
                      />
                    </div>
                  </div>
                ))}

                {/* Add new slice segment */}
                <button
                  onClick={() => {
                    const remaining = parseFloat((activeSplitTx.amount - totalSplitAllocated).toFixed(2));
                    setTempSplits([...tempSplits, { 
                      category: 'Miscellaneous', 
                      amount: remaining > 0 ? remaining : 0 
                    }]);
                  }}
                  className="w-full border border-dashed text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-300 rounded p-2 text-center text-xs font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Split Section Addition
                </button>
              </div>

              {/* Status Validation warnings */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Allocated Spending:</span>
                  <span className="font-mono font-bold text-slate-800">${totalSplitAllocated.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Remainder Balance:</span>
                  <span className={`font-mono font-bold ${
                    Math.abs(activeSplitTx.amount - totalSplitAllocated) < 0.01 
                      ? 'text-emerald-600' 
                      : 'text-amber-600'
                  }`}>
                    ${(activeSplitTx.amount - totalSplitAllocated).toFixed(2)}
                  </span>
                </div>

                {Math.abs(activeSplitTx.amount - totalSplitAllocated) >= 0.01 && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded line-height-tight font-medium">
                    ⚠️ Split Sum must match total amount exactly to commit changes.
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setSplitTxId(null)}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-1.5 px-3 rounded text-xs font-bold uppercase transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplySplits}
                    disabled={Math.abs(activeSplitTx.amount - totalSplitAllocated) >= 0.01}
                    className="flex-1 bg-slate-900 disabled:opacity-50 hover:bg-slate-800 text-white py-1.5 px-3 rounded text-xs font-bold uppercase transition-all"
                  >
                    Apply Splits
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-250 border-dashed rounded-xl p-8 text-center text-slate-400 select-none space-y-2">
              <SlidersHorizontal className="h-6 w-6 mx-auto text-slate-300" />
              <p className="text-xs font-bold">Category Splitting Dashboard</p>
              <p className="text-[10px] text-slate-500">Select "Split Row" on any debit transaction in the ledger list to configure fine-grained line-item allocations.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
