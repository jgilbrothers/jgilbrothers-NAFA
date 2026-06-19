import React, { useState } from 'react';
import { 
  FolderSearch, 
  Check, 
  HelpCircle, 
  FileText, 
  CornerDownRight, 
  Building,
  BookmarkPlus
} from 'lucide-react';
import { DocumentRecord, AccountSummary } from '../types';

interface NeedsReviewQueueProps {
  documents: DocumentRecord[];
  accounts: AccountSummary[];
  onClassify: (docId: string, accountId: string, classificationType: DocumentRecord['file_type']) => void;
}

export default function NeedsReviewQueue({
  documents,
  accounts,
  onClassify
}: NeedsReviewQueueProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [classificationType, setClassificationType] = useState<DocumentRecord['file_type']>('Checking Statement');

  const needsReviewDocs = documents.filter(doc => doc.file_type === 'Unknown / Needs Review' || doc.processing_status === 'Requires Classification');

  const activeDoc = documents.find(d => d.id === selectedDocId) || needsReviewDocs[0] || null;

  const handleClassifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc) return;

    onClassify(activeDoc.id, accountId, classificationType);
    setSelectedDocId(null);
    setAccountId('');
  };

  return (
    <div className="space-y-6" id="needs-review-queue-container">

      {/* Description headings */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Needs Review Documents Queue</h4>
        <p className="text-xs text-slate-500 mt-0.5">Manage low-confidence uploads lacking explicit bank logos or statement suffix attributes. Direct manual mappings to incorporate records.</p>
      </div>

      {needsReviewDocs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* List of files needing mapping */}
          <div className="lg:col-span-1 space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Classification ({needsReviewDocs.length})</h5>
            
            <div className="space-y-2">
              {needsReviewDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left p-3.5 border transition-all rounded-xl block ${
                    activeDoc?.id === doc.id 
                      ? 'bg-amber-50/50 border-amber-300 shadow-sm' 
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold font-mono text-slate-900 truncate">{doc.filename}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-sans">
                        Read Quality: <strong className="font-mono">{Math.round(doc.ocr_confidence * 100)}%</strong>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Classification details / side-by-side document text viewer */}
          {activeDoc && (
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Side-by-side raw text preview */}
              <div className="bg-slate-950 text-slate-300 rounded-xl p-4 border border-slate-800 flex flex-col justify-between h-[380px]">
                <div>
                  <div className="border-b border-slate-800 pb-2 mb-3">
                    <p className="text-[9px] font-bold text-amber-500 uppercase">Extracted Document Text</p>
                    <h6 className="text-[10px] font-semibold font-mono truncate text-white mt-0.5">{activeDoc.filename}</h6>
                  </div>
                  <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-y-auto">
                    {activeDoc.raw_text || "No extracted text found."}
                  </pre>
                </div>
                <div className="text-[9px] text-slate-500 pt-2 border-t border-slate-800 font-sans">
                  Use this extract to identify institutions or suffix targets.
                </div>
              </div>

              {/* Right Column: Classification forms */}
              <div className="bg-white border text-slate-900 border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between h-[380px]">
                
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      Needs Classification Mappings
                    </span>
                    <h5 className="font-bold text-slate-900 text-sm mt-2">{activeDoc.filename}</h5>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">
                      Identified Date: {new Date(activeDoc.upload_timestamp).toLocaleDateString()}
                    </p>
                  </div>

                  <form onSubmit={handleClassifySubmit} className="space-y-3 text-xs text-slate-900">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Optional Account Association</label>
                      <select
                        value={accountId}
                        onChange={e => setAccountId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-bold focus:border-indigo-400 focus:outline-hidden"
                      >
                        <option value="">-- No Associated Account --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} (*{acc.account_suffix})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Declare Document Type</label>
                      <select
                        value={classificationType}
                        onChange={e => setClassificationType(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-900 font-bold focus:border-indigo-400 focus:outline-hidden"
                      >
                        <option value="Checking Statement">Checking Statement</option>
                        <option value="Savings Statement">Savings Statement</option>
                        <option value="Credit Card Statement">Credit Card Statement</option>
                        <option value="Paystub">Paystub</option>
                        <option value="Receipt">Receipt</option>
                        <option value="Tax Document">Tax Document</option>
                        <option value="Court Document">Court Document</option>
                        <option value="Legal Order">Legal Order</option>
                        <option value="Loan Document">Loan Document</option>
                        <option value="Utility Bill">Utility Bill</option>
                        <option value="Insurance Document">Insurance Document</option>
                        <option value="Other">Other</option>
                        <option value="Unknown / Needs Review">Unknown / Needs Review</option>
                      </select>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-colors cursor-pointer text-center"
                      >
                        Approve & Classify Document
                      </button>
                    </div>
                  </form>
                </div>

                <div className="text-[10px] text-slate-450 italic leading-tight pt-2 border-t font-sans font-medium">
                  Classification updates this document record. Account association is optional metadata.
                </div>

              </div>

            </div>
          )}

        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 select-none">
          <FolderSearch className="h-8 w-8 mx-auto mb-2 text-slate-350" />
          <p className="text-xs font-bold">Needs Review Documents Queue is completely clear</p>
          <p className="text-[10px] text-slate-500 mt-1">Excellent! All uploaded statement documents are currently classified or marked for review.</p>
        </div>
      )}

    </div>
  );
}
