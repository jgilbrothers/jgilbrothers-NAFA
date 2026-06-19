import React, { useState } from 'react';
import { 
  FileUp, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  FileText, 
  Calendar, 
  Search,
  Check,
  RotateCw,
  Sparkles,
  Layers
} from 'lucide-react';
import { DocumentRecord, AccountSummary, Transaction } from '../types';

interface DocumentsViewProps {
  documents: DocumentRecord[];
  accounts: AccountSummary[];
  transactions: Transaction[];
  onAddDocument: (doc: DocumentRecord) => void;
  onDeleteDocument: (id: string) => void;
  onLinkAccount: (docId: string, accountId: string) => void;
  onImportTransactions?: (txs: Transaction[], doc: DocumentRecord) => void;
  onViewExtractedTransactions?: (docId: string) => void;
}

export default function DocumentsView({
  documents,
  accounts,
  transactions,
  onAddDocument,
  onDeleteDocument,
  onLinkAccount,
  onImportTransactions,
  onViewExtractedTransactions
}: DocumentsViewProps) {
  const [dragActive, setDragActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    filename: '',
    file_type: 'Checking' as DocumentRecord['file_type'],
    institution_name: '',
    statement_period: '',
    user_notes: ''
  });

  const [recentImports, setRecentImports] = useState<{id: string; filename: string; timestamp: string; status: 'completed' | 'failed'}[]>([
    { id: 'REC-1', filename: 'Chasechecking_May2026.csv', timestamp: '2026-06-05', status: 'completed' },
    { id: 'REC-2', filename: 'Paystub_June2026_unparsed.pdf', timestamp: '2026-06-06', status: 'failed' }
  ]);

  const handleRetryImport = (id: string, filename: string) => {
    setIsUploading(true);
    setTimeout(() => {
      const retryId = `DOC-RETRY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newDoc: DocumentRecord = {
        id: retryId,
        filename: filename.replace('_unparsed', ''),
        upload_timestamp: new Date().toISOString(),
        file_type: 'Checking',
        ocr_status: 'Success',
        ocr_confidence: 0.98,
        institution_name: 'Metro National Bank',
        statement_period: '05/01/2026 - 05/31/2026',
        processing_status: 'Completed',
        user_notes: 'Retried failed statement ingestion'
      };
      
      onAddDocument(newDoc);
      setRecentImports(prev => prev.map(item => item.id === id ? { ...item, status: 'completed', id: retryId } : item));
      setIsUploading(false);
    }, 1000);
  };

  // CSV paste/import workflow states
  const [csvText, setCsvText] = useState('');
  const [csvParsedRows, setCsvParsedRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    dateIdx: 0,
    descIdx: 1,
    amountIdx: 2,
    typeIdx: 3,
    catIdx: -1
  });
  const [csvAccount, setCsvAccount] = useState('');
  const [csvDocType, setCsvDocType] = useState<DocumentRecord['file_type']>('Checking');
  const [csvInstitution, setCsvInstitution] = useState('');
  const [csvPeriod, setCsvPeriod] = useState('05/01/2026 - 05/31/2026');
  const [routeToReviewQueue, setRouteToReviewQueue] = useState(false);
  const [isCsvPanelOpen, setIsCsvPanelOpen] = useState(false);
  const [csvErrorMessage, setCsvErrorMessage] = useState('');

  // Structured PDF Smart Heuristics states
  const [pdfText, setPdfText] = useState('');
  const [pdfParsedRows, setPdfParsedRows] = useState<{
    date: string;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
    runningBalance?: number;
    confidence: number;
  }[]>([]);
  const [pdfInstitution, setPdfInstitution] = useState('');
  const [pdfPeriod, setPdfPeriod] = useState('');
  const [pdfSuffix, setPdfSuffix] = useState('');
  const [pdfAccount, setPdfAccount] = useState('');
  const [pdfDocType, setPdfDocType] = useState<DocumentRecord['file_type']>('Checking');
  const [isPdfPanelOpen, setIsPdfPanelOpen] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState('');
  const [forcePdfReview, setForcePdfReview] = useState(false);

  // Intelligent Text-based PDF Structured Heuristics Parser
  const handleParsePdf = () => {
    if (!pdfText.trim()) {
      setPdfErrorMessage('Please paste the textual content of your PDF statement first.');
      return;
    }

    try {
      // 1. Identify Financial Institution Name from text clues
      let detectedInst = '';
      const textLower = pdfText.toLowerCase();
      const instMatches = [
        { name: 'Chase Bank', keywords: ['chase', 'jp morgan', 'jpmorgan'] },
        { name: 'Wells Fargo', keywords: ['wells fargo', 'fargo'] },
        { name: 'Bank of America', keywords: ['bank of america', 'bofa', 'boa'] },
        { name: 'Metro National Bank', keywords: ['metro national', 'metro bank'] },
        { name: 'NC State Credit Union', keywords: ['credit union', 'secu', 'nc state'] },
        { name: 'Apex Elite Bank', keywords: ['apex', 'apex elite'] },
      ];
      for (const inst of instMatches) {
        if (inst.keywords.some(kw => textLower.includes(kw))) {
          detectedInst = inst.name;
          break;
        }
      }
      setPdfInstitution(detectedInst || 'Generic Financial Institution');

      // 2. Identify Account Suffix Checks
      let detectedSuffix = '7789';
      const suffixRegexes = [
        /account\s+(?:number\s+)?(?:ending\s+in\s+)?\*?(\d{4})/i,
        /card\s+(?:number\s+)?(?:ending\s+in\s+)?\*?(\d{4})/i,
        /acct\s+#?\s*\*?(\d{4})/i,
        /ending\s+in\s+\*?(\d{4})/i,
      ];
      for (const rx of suffixRegexes) {
        const ms = pdfText.match(rx);
        if (ms && ms[1]) {
          detectedSuffix = ms[1];
          break;
        }
      }
      setPdfSuffix(detectedSuffix);

      // 3. Line by Line parse extracting Dates, Descriptions, Split/Amounts & Balances
      const lines = pdfText.split('\n');
      const parsed: typeof pdfParsedRows = [];

      // Date regex support for "05/12/2026", "05-12-26", "May 12, 2026", "Mar 15, 2026"
      const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:\s*,\s*\d{4})?\b/i;
      
      // Matches clean currency strings like "$1,250.00", "-$54.20", "28.50-"
      const currencyRegex = /[-+]?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})[-+]?/g;

      lines.forEach(line => {
        const clean = line.trim();
        if (!clean) return;

        const dMatch = clean.match(dateRegex);
        if (dMatch) {
          const txDate = dMatch[0];
          
          // Remove the date segment to dissect merchant text
          const indexBody = clean.replace(txDate, '').trim();
          const moneyMatches = indexBody.match(currencyRegex) || [];

          let description = indexBody;
          moneyMatches.forEach(m => {
            description = description.replace(m, '');
          });

          // Standard cleaning
          description = description
            .replace(/[\d\.\,\$\-\+]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (description.length < 3) {
            description = 'Merchant POS Withdrawal';
          }

          let amount = 0;
          let isCredit = false;
          let runningBal: number | undefined = undefined;

          if (moneyMatches.length >= 1) {
            const cleanMoney = (s: string) => parseFloat(s.replace(/[$,]/g, ''));
            const firstVal = cleanMoney(moneyMatches[0]);

            if (moneyMatches.length >= 2) {
              // Dual values on line: the first is transaction amount, second is running balance!
              runningBal = cleanMoney(moneyMatches[1]);
            }

            // Keyword hints regarding Credits versus Debits (e.g. income / payroll / refund is positive)
            const lowerLine = clean.toLowerCase();
            isCredit = 
              lowerLine.includes('payroll') || 
              lowerLine.includes('deposit') || 
              lowerLine.includes('dividend') || 
              lowerLine.includes('incoming') || 
              lowerLine.includes('credit') || 
              (firstVal < 0 && lowerLine.includes('refund')) ||
              moneyMatches[0].startsWith('+');

            amount = Math.abs(firstVal);
          }

          if (amount > 0) {
            parsed.push({
              date: txDate,
              description,
              amount,
              type: isCredit ? 'credit' : 'debit',
              runningBalance: runningBal,
              confidence: 0.94
            });
          }
        }
      });

      if (parsed.length === 0) {
        setPdfErrorMessage('Confidence warning: Heuristic parser found no structured transaction lines. We will parse it with 65% OCR confidence rating, which routes this file directory into the Unresolved Review Queue for safety.');
        setPdfParsedRows([]);
        setPdfPeriod('05/01/2026 - 05/31/2026');
      } else {
        setPdfErrorMessage('');
        setPdfParsedRows(parsed);
        // Set dynamic date period matching first vs last rows
        const start = parsed[parsed.length - 1].date;
        const end = parsed[0].date;
        setPdfPeriod(`${start} - ${end}`);
      }

    } catch (err: any) {
      setPdfErrorMessage('Structured parse error: ' + err.message);
    }
  };

  const handleImportPdf = () => {
    if (!pdfAccount) {
      setPdfErrorMessage('Please bind this PDF Statement to a related account.');
      return;
    }

    const selectedAcc = accounts.find(a => a.id === pdfAccount);
    const suffix = pdfSuffix || selectedAcc?.account_suffix || '9955';
    const isLowConfidence = pdfParsedRows.length === 0 || forcePdfReview;
    const filename = `ParsedPDF_${pdfInstitution.replace(/\s+/g, '')}_*${suffix}.pdf`;
    const docId = `DOC-PDF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Synthesize DocumentRecord
    const newDoc: DocumentRecord = {
      id: docId,
      filename,
      upload_timestamp: new Date().toISOString(),
      file_type: pdfDocType,
      ocr_status: isLowConfidence ? 'Low Confidence' : 'Success',
      ocr_confidence: isLowConfidence ? 0.65 : 0.95,
      account_id: pdfAccount,
      institution_name: pdfInstitution || selectedAcc?.institution_name || 'Generic Bank',
      statement_period: pdfPeriod || '05/01/2026 - 05/31/2026',
      processing_status: isLowConfidence ? 'Requires Verification' : 'Completed',
      user_notes: `Structured PDF Text Import (Extracted Suffix *${suffix})`
    };

    // 2. Synthesize Transactions
    const txs: Transaction[] = pdfParsedRows.map((row, index) => {
      return {
        transaction_id: `TX-PDF-${docId.replace('DOC-PDF-', '')}-${index + 1}`,
        transaction_date: row.date,
        raw_description: row.description,
        clean_vendor_name: row.description.split(/\s+/).slice(0, 3).join(' '),
        amount: row.amount,
        transaction_type: row.type,
        processing_method: 'ACH',
        card_or_account_suffix: suffix,
        category: 'Miscellaneous',
        is_pending: false,
        running_balance: row.runningBalance,
        source_document_id: docId,
        confidence_score: isLowConfidence ? 0.65 : row.confidence,
        duplicate_status: undefined,
        transfer_status: undefined
      };
    });

    if (onImportTransactions) {
      onImportTransactions(txs, newDoc);
    } else {
      onAddDocument(newDoc);
    }

    // Reset workflow states
    setPdfText('');
    setPdfParsedRows([]);
    setPdfInstitution('');
    setPdfPeriod('');
    setPdfSuffix('');
    setPdfErrorMessage('');
    setIsPdfPanelOpen(false);
  };

  // Sane CSV split parser
  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/);
    return lines
      .map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      })
      .filter(row => row.length > 0 && row.some(cell => cell !== ''));
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) {
      setCsvErrorMessage('Please paste some CSV text first.');
      return;
    }
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) {
        setCsvErrorMessage('No text or rows detected. Please check your pasted content.');
        return;
      }
      setCsvErrorMessage('');
      const headers = rows[0];
      setCsvParsedRows(rows.slice(1));
      setCsvHeaders(headers);

      // Try automatic mapping based on header keywords
      let dateIdx = 0;
      let descIdx = 1;
      let amountIdx = 2;
      let typeIdx = 3;
      let catIdx = -1;

      headers.forEach((h, idx) => {
        const u = h.toLowerCase();
        if (u.includes('date')) dateIdx = idx;
        else if (u.includes('desc') || u.includes('vendor') || u.includes('merchant') || u.includes('payee')) descIdx = idx;
        else if (u.includes('amount') || u.includes('sum') || u.includes('val')) amountIdx = idx;
        else if (u.includes('type') || u.includes('debit') || u.includes('credit')) typeIdx = idx;
        else if (u.includes('cat')) catIdx = idx;
      });

      setColumnMapping({ dateIdx, descIdx, amountIdx, typeIdx, catIdx });
    } catch (err: any) {
      setCsvErrorMessage('Error parsing CSV: ' + err.message);
    }
  };

  const handleImportCsv = () => {
    if (csvParsedRows.length === 0) {
      setCsvErrorMessage('No parsed rows to import. Parse some CSV data first.');
      return;
    }
    if (!csvAccount) {
      setCsvErrorMessage('Please select a target account for this statement.');
      return;
    }

    const selectedAcc = accounts.find(a => a.id === csvAccount);
    const suffix = selectedAcc ? selectedAcc.account_suffix : '4321';
    const filename = `CSV_Import_${selectedAcc?.account_name || 'Statement'}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    const docId = `DOC-CSV-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Synthesize DocumentRecord
    const newDoc: DocumentRecord = {
      id: docId,
      filename,
      upload_timestamp: new Date().toISOString(),
      file_type: csvDocType,
      ocr_status: routeToReviewQueue ? 'Low Confidence' : 'Success',
      ocr_confidence: routeToReviewQueue ? 0.65 : 0.98,
      account_id: csvAccount,
      institution_name: csvInstitution || selectedAcc?.institution_name || 'Generic Bank',
      statement_period: csvPeriod,
      processing_status: routeToReviewQueue ? 'Requires Verification' : 'Completed',
      user_notes: 'CSV manually pasted database import'
    };

    // 2. Synthesize Transactions
    const txs: Transaction[] = csvParsedRows.map((row, index) => {
      const rawDate = row[columnMapping.dateIdx] || new Date().toISOString().substring(0, 10);
      const rawDesc = row[columnMapping.descIdx] || 'Unidentified merchant column';
      const rawAmountStr = (row[columnMapping.amountIdx] || '0').replace(/[$,]/g, '').trim();
      const rawAmount = parseFloat(rawAmountStr) || 0;
      const rawTypeVal = (row[columnMapping.typeIdx] || 'debit').toLowerCase();
      const rawCatVal = columnMapping.catIdx >= 0 ? row[columnMapping.catIdx] : 'Miscellaneous';

      const tx_type = (rawTypeVal.includes('credit') || rawAmount > 0 && !rawTypeVal.includes('debit')) ? 'credit' : 'debit';
      const amount = Math.abs(rawAmount);

      return {
        transaction_id: `TX-CSV-${docId.replace('DOC-CSV-', '')}-${index + 1}`,
        transaction_date: rawDate,
        raw_description: rawDesc,
        clean_vendor_name: rawDesc.split(/\s+/).slice(0, 3).join(' '),
        amount,
        transaction_type: tx_type,
        processing_method: 'Other',
        card_or_account_suffix: suffix,
        category: rawCatVal || 'Miscellaneous',
        is_pending: false,
        source_document_id: docId,
        confidence_score: routeToReviewQueue ? 0.65 : 0.95,
        duplicate_status: undefined,
        transfer_status: undefined
      };
    });

    if (onImportTransactions) {
      onImportTransactions(txs, newDoc);
    } else {
      onAddDocument(newDoc);
    }

    // Reset Import panel
    setCsvText('');
    setCsvParsedRows([]);
    setCsvHeaders([]);
    setCsvErrorMessage('');
    setIsCsvPanelOpen(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      simulateFileUpload(file.name);
    }
  };

  const simulateFileUpload = (name: string) => {
    setIsUploading(true);
    setTimeout(() => {
      onAddDocument({
        id: `DOC-NEW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        filename: name,
        upload_timestamp: new Date().toISOString(),
        file_type: 'Checking',
        ocr_status: 'Success',
        ocr_confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(2)),
        institution_name: 'Metro National Bank',
        statement_period: '05/01/2026 - 05/31/2026',
        processing_status: 'Completed',
        user_notes: 'User uploaded statement simulation'
      });
      setIsUploading(false);
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.filename) return;

    onAddDocument({
      id: `DOC-NEW-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      filename: formData.filename,
      upload_timestamp: new Date().toISOString(),
      file_type: formData.file_type,
      ocr_status: 'Success',
      ocr_confidence: 0.95,
      institution_name: formData.institution_name || 'Generic Institution',
      statement_period: formData.statement_period || '05/01/2026 - 05/31/2026',
      processing_status: 'Completed',
      user_notes: formData.user_notes || ''
    });

    setFormData({
      filename: '',
      file_type: 'Checking',
      institution_name: '',
      statement_period: '',
      user_notes: ''
    });
  };

  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchText.toLowerCase()) ||
    doc.institution_name.toLowerCase().includes(searchText.toLowerCase()) ||
    doc.file_type.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-6" id="documents-view-container">
      
      {/* Visual upload frame + Ingestion Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Drag & Drop Ingestion Zone */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Ingest Statements Document Folder</h4>
            <p className="text-xs text-slate-500 mb-4">
              Simulate dragging or selecting transaction file records. Statements are parsed server-side against standard OCR templates.
            </p>

            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/40' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <FileUp className="h-8 w-8 text-slate-400 mb-2 animate-bounce" />
              {isUploading ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-semibold justify-center">
                    <RotateCw className="h-3 w-3 animate-spin text-indigo-600" /> Ingestion Optical Read Parsing...
                  </div>
                  <div className="w-40 bg-slate-100 h-1 rounded overflow-hidden mx-auto">
                    <div className="bg-indigo-600 h-full animate-[loading_1s_infinite]" />
                  </div>
                </div>
              ) : (
                <div className="space-y-1 select-none">
                  <p className="text-xs font-bold text-slate-800">Drag and drop statement files here</p>
                  <p className="text-[10px] text-slate-400">PDF, CSV, JPEG or TXT files supported</p>
                  <label className="inline-block mt-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-1 px-3 rounded cursor-pointer transition-colors shadow-sm">
                    Select File
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          simulateFileUpload(e.target.files[0].name);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Recent Imports List & Retry Flow */}
            <div className="bg-white border text-xs border-slate-200 rounded-xl p-4 shadow-xs mt-3.5 space-y-2.5">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Ingestion Diagnostics</h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {recentImports.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-150 font-mono text-[10px]">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`h-2 w-2.5 rounded-full shrink-0 ${
                        item.status === 'completed' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                      }`} />
                      <span className="font-bold text-slate-800 truncate" title={item.filename}>{item.filename}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[8.5px] uppercase font-bold px-1 py-0.2 rounded ${
                        item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {item.status}
                      </span>
                      {item.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => handleRetryImport(item.id, item.filename)}
                          className="text-[9px] font-sans font-bold bg-indigo-600 hover:bg-indigo-700 hover:text-white text-indigo-100 py-1 px-1.5 rounded transition-all cursor-pointer"
                        >
                          Retry Parse
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Manual classification Form inputs (OCR Overrider) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Manual statement upload forms</h4>
          <p className="text-xs text-slate-500 mb-4">Directly key statement details into memory to test matching rules instantaneously.</p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">File Name</label>
              <input 
                type="text"
                required
                placeholder="e.g. CardVisa_DurhamStatement.csv"
                value={formData.filename}
                onChange={e => setFormData({...formData, filename: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statement Type</label>
              <select
                value={formData.file_type}
                onChange={e => setFormData({...formData, file_type: e.target.value as any})}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
              >
                <option value="Checking">Checking Account</option>
                <option value="Savings">Savings Account</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Receipt">Receipt Document</option>
                <option value="Paystub">Paystub Segment</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Institution name</label>
              <input 
                type="text"
                placeholder="e.g. Apex Bank Trust"
                value={formData.institution_name}
                onChange={e => setFormData({...formData, institution_name: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statement Dates (Range)</label>
              <input 
                type="text"
                placeholder="05/01/2026 - 05/31/2026"
                value={formData.statement_period}
                onChange={e => setFormData({...formData, statement_period: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes / Description</label>
              <input 
                type="text"
                placeholder="e.g. Joint childcare charges"
                value={formData.user_notes}
                onChange={e => setFormData({...formData, user_notes: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-sans outline-hidden"
              />
            </div>

            <div className="sm:col-span-2 pt-2">
              <button 
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-2 px-4 rounded transition-colors cursor-pointer text-center"
              >
                Incorporate Document Record
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* CSV Paste & Import Wizard */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" id="csv-import-panel">
        <div 
          onClick={() => setIsCsvPanelOpen(!isCsvPanelOpen)}
          className="p-4 bg-slate-100 hover:bg-slate-200/80 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-200"
        >
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-1.5 rounded text-emerald-700">
              <FileUp className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">CSV Data Pasting & Import Wizard</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Quickly import statement transactions from spreadsheets or text files with header mapping.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase">
            {isCsvPanelOpen ? 'Hide Panel' : 'Expand Panel'}
          </span>
        </div>

        {isCsvPanelOpen && (
          <div className="p-5 space-y-4 animate-fadeIn" id="csv-wizard-interior">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Paste Raw CSV Text Content</label>
                <textarea 
                  rows={6}
                  placeholder={`Date,Description,Amount,Type\n05/18/2026,"Whole Foods",124.50,debit\n05/19/2026,"YMCA Childcare",260.00,debit`}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-slate-900 font-mono text-[11px] outline-hidden focus:border-indigo-400 focus:bg-white"
                />
                
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleParseCsv}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded cursor-pointer transition-colors"
                  >
                    Parse Paste Data
                  </button>
                  {csvHeaders.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Parsed {csvParsedRows.length} rows successfully!
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Account Custody</label>
                  <select
                    value={csvAccount}
                    onChange={e => setCsvAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
                  >
                    <option value="">-- Choose Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} (*{acc.account_suffix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Document type</label>
                  <select
                    value={csvDocType}
                    onChange={e => setCsvDocType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
                  >
                    <option value="Checking">Checking Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Receipt">Receipt Ledger</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Institution Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Metro National Bank"
                    value={csvInstitution}
                    onChange={e => setCsvInstitution(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statement Dates (Period)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 05/01/2026 - 05/31/2026"
                    value={csvPeriod}
                    onChange={e => setCsvPeriod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-2">
                  <label className="flex items-start gap-2 select-none cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={routeToReviewQueue}
                      onChange={e => setRouteToReviewQueue(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="text-[10px] font-bold text-slate-700 uppercase block">Flags unclear Columns / Force Review Queue routing</span>
                      <span className="text-[9px] text-slate-400 block -mt-0.5">Mock OCR read failure. Force confidence score to 65% to trigger low-confidence alert verification.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {csvHeaders.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-3 space-y-3">
                <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-600" /> Choose Column Header Alignments
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[10px]">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Transaction date</label>
                    <select
                      value={columnMapping.dateIdx}
                      onChange={e => setColumnMapping({...columnMapping, dateIdx: parseInt(e.target.value)})}
                      className="w-full bg-white border border-slate-200 rounded p-1 outline-hidden"
                    >
                      {csvHeaders.map((head, idx) => (
                        <option key={idx} value={idx}>{head} (col {idx+1})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Description / Payee</label>
                    <select
                      value={columnMapping.descIdx}
                      onChange={e => setColumnMapping({...columnMapping, descIdx: parseInt(e.target.value)})}
                      className="w-full bg-white border border-slate-200 rounded p-1 outline-hidden"
                    >
                      {csvHeaders.map((head, idx) => (
                        <option key={idx} value={idx}>{head} (col {idx+1})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Amount Column</label>
                    <select
                      value={columnMapping.amountIdx}
                      onChange={e => setColumnMapping({...columnMapping, amountIdx: parseInt(e.target.value)})}
                      className="w-full bg-white border border-slate-200 rounded p-1 outline-hidden"
                    >
                      {csvHeaders.map((head, idx) => (
                        <option key={idx} value={idx}>{head} (col {idx+1})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Debit / Credit Type</label>
                    <select
                      value={columnMapping.typeIdx}
                      onChange={e => setColumnMapping({...columnMapping, typeIdx: parseInt(e.target.value)})}
                      className="w-full bg-white border border-slate-200 rounded p-1 outline-hidden"
                    >
                      {csvHeaders.map((head, idx) => (
                        <option key={idx} value={idx}>{head} (col {idx+1})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Category if Included</label>
                    <select
                      value={columnMapping.catIdx}
                      onChange={e => setColumnMapping({...columnMapping, catIdx: parseInt(e.target.value)})}
                      className="w-full bg-white border border-slate-200 rounded p-1 outline-hidden"
                    >
                      <option value={-1}>-- None --</option>
                      {csvHeaders.map((head, idx) => (
                        <option key={idx} value={idx}>{head} (col {idx+1})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Parsed Preview (First 4 Rows)</div>
                  <table className="w-full text-left font-mono text-[10px] divide-y divide-slate-100 font-normal">
                    <thead>
                      <tr className="text-slate-500 uppercase">
                        {csvHeaders.map((h, idx) => (
                          <th key={idx} className="pb-1 px-1 font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {csvParsedRows.slice(0, 4).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-1 px-1 font-mono">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={handleImportCsv}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase py-2 px-5 rounded-md cursor-pointer transition-colors shadow-xs"
                  >
                    Confirm Import ({csvParsedRows.length} Transactions)
                  </button>
                </div>
              </div>
            )}

            {csvErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{csvErrorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF Intelligent Heuristics Parser Wizard */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden" id="pdf-import-panel">
        <div 
          onClick={() => setIsPdfPanelOpen(!isPdfPanelOpen)}
          className="p-4 bg-slate-100 hover:bg-slate-200/80 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-200"
        >
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-1.5 rounded text-indigo-700">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Structured PDF Statement Text Parser (OCR Core)</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Paste raw statement copy or text-based PDF content to extract dates, vendors, credits, and active balances.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase">
            {isPdfPanelOpen ? 'Hide Panel' : 'Expand Panel'}
          </span>
        </div>

        {isPdfPanelOpen && (
          <div className="p-5 space-y-4 animate-fadeIn" id="pdf-wizard-interior">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Paste Text Content from Text-based PDF or Bank Portal Clip</label>
                <textarea 
                  rows={6}
                  placeholder={`CHASE BANK STATEMENT FOR ACCOUNT *5531\n05/10/2026   WHOLE FOODS MARKET $84.20    BAL $4,510.35\n05/12/2026   METRO POWER GASOLINE COMMISSION -$34.20  BAL $4,476.15\n05/14/2026   DIRECT DEPOSIT NC STATE PAYROLL +$3,500.00`}
                  value={pdfText}
                  onChange={e => setPdfText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-slate-900 font-mono text-[11px] outline-hidden focus:border-indigo-400 focus:bg-white"
                />
                
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleParsePdf}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded cursor-pointer transition-colors"
                  >
                    Run Heuristic Extraction
                  </button>
                  {pdfParsedRows.length > 0 && (
                    <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Extracted {pdfParsedRows.length} ledger lines!
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bind to Custody Accounts</label>
                  <select
                    value={pdfAccount}
                    onChange={e => setPdfAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden focus:border-indigo-400"
                  >
                    <option value="">-- Choose Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} (*{acc.account_suffix})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Document type</label>
                  <select
                    value={pdfDocType}
                    onChange={e => setPdfDocType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden focus:border-indigo-400"
                  >
                    <option value="Checking">Checking Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Receipt">Receipt Ledger</option>
                    <option value="Paystub">Paystub Ledger</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Extracted Institution</label>
                  <input 
                    type="text"
                    placeholder="e.g. Chase Bank"
                    value={pdfInstitution}
                    onChange={e => setPdfInstitution(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Detected Statement Period</label>
                  <input 
                    type="text"
                    placeholder="e.g. 05/01/2026 - 05/31/2026"
                    value={pdfPeriod}
                    onChange={e => setPdfPeriod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Detected Suffix (*)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 5531"
                    value={pdfSuffix}
                    onChange={e => setPdfSuffix(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-mono outline-hidden focus:border-indigo-400"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-start gap-2 select-none cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={forcePdfReview}
                      onChange={e => setForcePdfReview(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="text-[10px] font-bold text-slate-700 uppercase block">Force Low-Confidence Routing</span>
                      <span className="text-[8px] text-slate-400 block font-semibold leading-none">Pushes statements directly to the Review Queue</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {pdfParsedRows.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto">
                  <div className="text-[9px] font-bold text-slate-405 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Heuristical Extracted PDF Records Live Preview Table</span>
                    <span className="bg-indigo-50 text-indigo-700 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border border-indigo-150">Heuristic Extraction Rating: 94%</span>
                  </div>
                  <table className="w-full text-left font-mono text-[10px] divide-y divide-slate-100 font-normal">
                    <thead>
                      <tr className="text-slate-500 uppercase text-[9px]">
                        <th className="pb-1 px-1 font-bold">Line date</th>
                        <th className="pb-1 px-1 font-bold">Parsed Merchant / Description</th>
                        <th className="pb-1 px-1 font-bold">Type</th>
                        <th className="pb-1 px-1 font-bold">Amount</th>
                        <th className="pb-1 px-1 font-bold">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pdfParsedRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/50">
                          <td className="py-1 px-1 font-mono text-slate-500">{row.date}</td>
                          <td className="py-1 px-1 font-mono font-medium text-slate-800">{row.description}</td>
                          <td className="py-1 px-1 font-mono">
                            <span className={`px-1 py-0.2 rounded font-bold text-[8px] uppercase ${
                              row.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="py-1 px-1 font-mono font-bold text-slate-900">${row.amount.toFixed(2)}</td>
                          <td className="py-1 px-1 font-mono text-slate-400">
                            {row.runningBalance !== undefined ? `$${row.runningBalance.toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={handleImportPdf}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase py-2 px-5 rounded-md cursor-pointer transition-colors shadow-xs"
                  >
                    Confirm PDF statement Import ({pdfParsedRows.length} transactions)
                  </button>
                </div>
              </div>
            )}

            {pdfErrorMessage && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-805 text-[11px] rounded-lg flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>{pdfErrorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabular Documents List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ingested Statements Ledger Vault</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Documents are indexed locally so you can link source documents to accounts and transactions.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search statements..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-md text-xs font-mono outline-hidden focus:border-indigo-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                <th className="p-3">File details</th>
                <th className="p-3">Type</th>
                <th className="p-3">Date Range</th>
                <th className="p-3">Extracted Rows</th>
                <th className="p-3">Confidence Status</th>
                <th className="p-3">Linked Account</th>
                <th className="p-3">Issues Count</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => {
                const isUnderReview = doc.ocr_status === 'Low Confidence' || doc.ocr_confidence < 0.85;

                // Dynamically fetch extracted rows count & count matches
                const rowCount = transactions.filter(t => t.source_document_id === doc.id).length;
                const issuesCount = isUnderReview ? 1 : 0;

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-start gap-2.5">
                        <FileText className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 font-mono truncate">{doc.filename}</p>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            ID: {doc.id} · Ingested {new Date(doc.upload_timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200">
                        {doc.file_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[10px] text-slate-600">
                      {doc.statement_period || 'N/A'}
                    </td>
                    <td className="p-3 font-mono text-[11px] font-bold text-slate-700">
                      {rowCount > 0 ? (
                        <button
                          onClick={() => onViewExtractedTransactions && onViewExtractedTransactions(doc.id)}
                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded transition-colors cursor-pointer select-none inline-flex items-center gap-1 font-sans"
                        >
                          Show {rowCount} Rows
                        </button>
                      ) : (
                        <span className="text-slate-400 font-mono italic text-[10px]">None</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {isUnderReview ? (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1 rounded animate-pulse">
                              LOW CONF ({Math.round(doc.ocr_confidence * 100)}%)
                            </span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1 rounded">
                              EXCELLENT ({Math.round(doc.ocr_confidence * 100)}%)
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        value={doc.account_id || ''}
                        onChange={e => onLinkAccount(doc.id, e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-semibold text-slate-800 outline-hidden focus:border-indigo-400"
                      >
                        <option value="">-- Relate to Account --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} (*{doc.file_type === 'Paystub' ? 'Link Account' : acc.account_suffix})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      {issuesCount > 0 ? (
                        <span className="bg-rose-50 border border-rose-100 text-rose-700 font-mono font-bold text-[9px] px-1.5 py-0.5 rounded shrink-0">
                          ⚠️ {issuesCount} unresolved
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[9px] font-medium">None</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => onDeleteDocument(doc.id)}
                        className="text-slate-455 hover:text-red-650 transition-colors p-1"
                        title="Delete statement from ledger memory"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400 italic">
                    No matching statement documents matched.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
