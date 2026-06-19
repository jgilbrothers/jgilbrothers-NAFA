import React from 'react';
import { 
  ShieldAlert, 
  Check, 
  AlertTriangle, 
  HelpCircle, 
  ArrowLeftRight, 
  CopyCheck, 
  ChevronRight,
  UserCheck,
  Ban
} from 'lucide-react';
import { Transaction } from '../types';
import { ReconciliationItem } from '../utils/dataEngine';

interface ReviewCorrectionsQueueProps {
  reconciliationItems: ReconciliationItem[];
  onResolveItem: (id: string, newStatus: ReconciliationItem['status']) => void;
  onUpdateCategory: (txId: string, category: string) => void;
}

export default function ReviewCorrectionsQueue({
  reconciliationItems,
  onResolveItem,
  onUpdateCategory
}: ReviewCorrectionsQueueProps) {

  // Group items by type for user scannability
  const ocrItems = reconciliationItems.filter(i => i.type === 'Low_Confidence' && i.status === 'Unresolved');
  const duplicateItems = reconciliationItems.filter(i => i.type === 'Duplicate_Warning' && i.status === 'Unresolved');
  const transferItems = reconciliationItems.filter(i => i.type === 'Transfer_Match' && i.status === 'Unresolved');

  return (
    <div className="space-y-6" id="review-corrections-queue-container">

      {/* Description headings */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Needs Review & Corrections Vault</h4>
        <p className="text-xs text-slate-500 mt-0.5">Examine ledger discrepancy logs, approve low OCR reads, suppress statement duplicate errors, and verify bilateral transfers.</p>
      </div>

      {reconciliationItems.filter(r => r.status === 'Unresolved').length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 select-none space-y-2">
          <CopyCheck className="h-8 w-8 text-emerald-500 mx-auto" />
          <p className="text-xs font-bold text-slate-900">Needs Review list is completely pristine!</p>
          <p className="text-[10px] text-slate-500">Every OCR warning, duplicate transaction overlay, and transfer loop has been fully certified and closed.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Section A: Low Optical Read Confidence approvals */}
          {ocrItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-amber-50/40 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Low OCR Read Confidence Row verifications ({ocrItems.length})</h5>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Action Required</span>
              </div>

              <div className="divide-y divide-slate-100">
                {ocrItems.map((item) => {
                  const tx = item.transactionA;
                  if (!tx) return null;

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-4">
                      <div className="space-y-1 my-0.5 max-w-lg">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">{tx.transaction_date}</span>
                          <span className="bg-slate-100 text-slate-500 text-[9px] font-mono font-semibold px-1 py-0.5 rounded">
                            ID: {tx.transaction_id}
                          </span>
                          <span className="bg-amber-50 font-bold text-amber-700 font-mono text-[9px] px-1 rounded">
                            Optical Read quality: {tx.confidence_score ? Math.round(tx.confidence_score * 100) : 72}%
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 font-mono">"{tx.raw_description}"</p>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          The system extracted vendor **"{tx.clean_vendor_name}"** on account ***{tx.card_or_account_suffix}**. Verify values against your statements file source to confirm.
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-end gap-2 pr-1 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                        <span className="font-mono font-bold text-[13px] text-slate-950">
                          ${tx.amount.toFixed(2)}
                        </span>
                        <div className="flex gap-2.5">
                          <button
                            onClick={() => onResolveItem(item.id, 'Resolved')}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-1 px-3 rounded flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                          >
                            <UserCheck className="h-3 w-3" /> Approve Row
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section B: Duplicate transaction warnings list */}
          {duplicateItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50/20 border-b border-slate-200 flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Potential Duplicate Statement Ingestion warnings ({duplicateItems.length})</h5>
              </div>

              <div className="divide-y divide-slate-100">
                {duplicateItems.map((item) => {
                  const txA = item.transactionA;
                  const txB = item.transactionB;
                  if (!txA || !txB) return null;

                  return (
                    <div key={item.id} className="p-4 flex flex-col justify-between items-start text-xs gap-3">
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">{txA.transaction_date}</span>
                          <span className="bg-rose-50 font-bold text-rose-700 text-[9px] px-1.5 py-0.5 rounded">Identical rows overlay alert</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Two identical transactions were ingested on the same date for the same amount. This usually indicates an overlap Statement upload.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className="bg-slate-50 border rounded-lg p-2 font-mono text-[10px] text-slate-700">
                            <strong>Reference A:</strong> {txA.clean_vendor_name} (*{txA.card_or_account_suffix})
                            <span className="block font-bold mt-1">Amount: ${txA.amount.toFixed(2)}</span>
                          </div>
                          <div className="bg-slate-50 border rounded-lg p-2 font-mono text-[10px] text-slate-700">
                            <strong>Reference B:</strong> {txB.clean_vendor_name} (*{txB.card_or_account_suffix})
                            <span className="block font-bold mt-1">Amount: ${txB.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-2 w-full justify-end">
                        <button
                          onClick={() => onResolveItem(item.id, 'Flagged')}
                          className="bg-white hover:bg-slate-50 text-slate-700 border font-bold text-[10px] uppercase py-1 px-3 rounded flex items-center gap-1 cursor-pointer transition-all"
                        >
                          Keep Both
                        </button>
                        <button
                          onClick={() => onResolveItem(item.id, 'Resolved')}
                          className="bg-red-800 hover:bg-red-700 text-white font-bold text-[10px] uppercase py-1 px-3 rounded flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        >
                          <Ban className="h-3 w-3" /> Exclude Duplicate Row B
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section C: Bilateral transfers checking listings */}
          {transferItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 bg-indigo-50/20 border-b border-slate-200 flex items-center gap-2">
                <ArrowLeftRight className="h-4.5 w-4.5 text-indigo-600" />
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Internal Transfer Reconciliation links ({transferItems.length})</h5>
              </div>

              <div className="divide-y divide-slate-100 font-sans text-xs">
                {transferItems.map((item) => {
                  const deb = item.transactionA;
                  const cred = item.transactionB;
                  if (!deb || !cred) return null;

                  return (
                    <div key={item.id} className="p-4 flex flex-col justify-between items-start gap-4">
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className="bg-indigo-50 font-bold text-indigo-700 px-1.5 py-0.5 rounded">Reconciliation check</span>
                          <span className="text-slate-400">ID Link: {deb.transaction_id} &rarr; {cred.transaction_id}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          The system detected a debit on one account matching a credit on another within a 3-day window. Map as internal transfer to eliminate double-recording outflows.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="bg-slate-50 border rounded-lg p-2.5 space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Source Debit Account</span>
                            <p className="font-mono font-bold text-slate-800">{deb.clean_vendor_name} (*{deb.card_or_account_suffix})</p>
                            <p className="font-mono text-slate-600 text-[10px]">Date: {deb.transaction_date}</p>
                            <p className="font-mono text-slate-950 font-bold">-${deb.amount.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-50 border rounded-lg p-2.5 space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Target Credit Account</span>
                            <p className="font-mono font-bold text-slate-800">{cred.clean_vendor_name} (*{cred.card_or_account_suffix})</p>
                            <p className="font-mono text-slate-600 text-[10px]">Date: {cred.transaction_date}</p>
                            <p className="font-mono text-emerald-700 font-bold">+${cred.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full justify-end">
                        <button
                          onClick={() => onResolveItem(item.id, 'Flagged')}
                          className="bg-white hover:bg-slate-50 text-slate-700 border font-bold text-[10px] uppercase py-1 px-3 rounded flex items-center gap-1 cursor-pointer transition-all"
                        >
                          Report Discrepancy
                        </button>
                        <button
                          onClick={() => {
                            // Automatically update categories to 'Transfers' on resolve
                            onUpdateCategory(deb.transaction_id, 'Transfers');
                            onUpdateCategory(cred.transaction_id, 'Transfers');
                            onResolveItem(item.id, 'Resolved');
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-1.5 px-3.5 rounded flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        >
                          <Check className="h-3 w-3" /> Reconcile Link & Lock Balance
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
