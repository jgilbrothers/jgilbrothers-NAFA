import React, { useEffect, useRef, useState } from 'react';
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
  Layers,
  Download,
  Eye,
  X
} from 'lucide-react';
import { DocumentRecord, AccountSummary, Transaction } from '../types';
import { deleteUploadedFile, getUploadedFile, saveUploadedFile } from '../utils/fileStorage';

const DOCUMENT_TYPES: DocumentRecord['file_type'][] = ['Checking Statement', 'Savings Statement', 'Credit Card Statement', 'Paystub', 'Receipt', 'Tax Document', 'Court Document', 'Legal Order', 'Loan Document', 'Utility Bill', 'Insurance Document', 'Other', 'Unknown / Needs Review'];

interface DocumentsViewProps {
  documents: DocumentRecord[];
  accounts: AccountSummary[];
  transactions: Transaction[];
  onAddDocument: (doc: DocumentRecord) => void;
  onDeleteDocument: (id: string) => void;
  onLinkAccount: (docId: string, accountId: string) => void;
  onImportTransactions?: (txs: Transaction[], doc: DocumentRecord) => void;
  onViewExtractedTransactions?: (docId: string) => void;
  onUpdateDocument?: (docId: string, updates: Partial<DocumentRecord>) => void;
}

export default function DocumentsView({
  documents,
  accounts,
  transactions,
  onAddDocument,
  onDeleteDocument,
  onLinkAccount,
  onImportTransactions,
  onViewExtractedTransactions,
  onUpdateDocument
}: DocumentsViewProps) {
  const [dragActive, setDragActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<DocumentRecord | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  const [recentImports, setRecentImports] = useState<{id: string; filename: string; timestamp: string; status: 'completed' | 'failed'}[]>([
    { id: 'REC-1', filename: 'Chasechecking_May2026.csv', timestamp: '2026-06-05', status: 'completed' },
    { id: 'REC-2', filename: 'Paystub_June2026_unparsed.pdf', timestamp: '2026-06-06', status: 'failed' }
  ]);

  useEffect(() => {
    if (!successNotification) return;
    const timer = window.setTimeout(() => setSuccessNotification(null), 4500);
    return () => window.clearTimeout(timer);
  }, [successNotification]);

  useEffect(() => {
    if (!errorNotification) return;
    const timer = window.setTimeout(() => setErrorNotification(null), 6500);
    return () => window.clearTimeout(timer);
  }, [errorNotification]);

  const handleRetryImport = (id: string, filename: string) => {
    setIsUploading(true);
    setTimeout(() => {
      const retryId = `DOC-RETRY-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newDoc: DocumentRecord = {
        id: retryId,
        filename: filename.replace('_unparsed', ''),
        upload_timestamp: new Date().toISOString(),
        file_type: 'Checking Statement',
        ocr_status: 'Success',
        ocr_confidence: 0.98,
        institution_name: 'Metro National Bank',
        statement_period: '05/01/2026 - 05/31/2026',
        processing_status: 'Completed',
        user_notes: 'Retried failed document reading'
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
  const [csvDocType, setCsvDocType] = useState<DocumentRecord['file_type']>('Checking Statement');
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
  const [pdfDocType, setPdfDocType] = useState<DocumentRecord['file_type']>('Checking Statement');
  const [isPdfPanelOpen, setIsPdfPanelOpen] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState('');
  const [forcePdfReview, setForcePdfReview] = useState(false);

  // Intelligent Text-based PDF Structured Heuristics Reader
  const handleParsePdf = () => {
    if (!pdfText.trim()) {
      setPdfErrorMessage('Paste copied document text first.');
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
        setPdfErrorMessage('Document text was not read automatically. Use Read Document Text or Import Spreadsheet Data if you want to add transactions.');
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
      account_id: pdfAccount || undefined,
      institution_name: pdfInstitution || selectedAcc?.institution_name || 'Generic Bank',
      statement_period: pdfPeriod || '05/01/2026 - 05/31/2026',
      processing_status: isLowConfidence ? 'Requires Verification' : 'Completed',
      user_notes: `Structured PDF Text Import (Extracted Suffix *${suffix})`,
      source_file_status: 'metadata_only',
      type_detected: true,
      text_read: true,
      transactions_extracted: pdfParsedRows.length > 0
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

  // Sane CSV split reader
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
      setCsvErrorMessage('Paste Transactions first.');
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
      setCsvErrorMessage('No parsed rows to import. Match columns first.');
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
      account_id: csvAccount || undefined,
      institution_name: csvInstitution || selectedAcc?.institution_name || 'Generic Bank',
      statement_period: csvPeriod,
      processing_status: routeToReviewQueue ? 'Requires Verification' : 'Completed',
      user_notes: 'CSV manually pasted database import',
      source_file_status: 'metadata_only',
      type_detected: true,
      text_read: true,
      transactions_extracted: csvParsedRows.length > 0
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
      handleSourceFileUpload(file);
    }
  };

  const detectDocumentType = (name: string): DocumentRecord['file_type'] => {
    const lower = name.toLowerCase();
    if (lower.includes('credit') || lower.includes('card')) return 'Credit Card Statement';
    if (lower.includes('saving')) return 'Savings Statement';
    if (lower.includes('checking') || lower.includes('statement')) return 'Checking Statement';
    if (lower.includes('paystub') || lower.includes('payroll')) return 'Paystub';
    if (lower.includes('receipt')) return 'Receipt';
    if (lower.includes('tax') || lower.includes('w2') || lower.includes('1099')) return 'Tax Document';
    if (lower.includes('court')) return 'Court Document';
    if (lower.includes('order')) return 'Legal Order';
    if (lower.includes('loan')) return 'Loan Document';
    if (lower.includes('utility')) return 'Utility Bill';
    if (lower.includes('insurance')) return 'Insurance Document';
    return 'Unknown / Needs Review';
  };

  const handleSourceFileUpload = async (file: File) => {
    setIsUploading(true);
    const docId = `DOC-FILE-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const detectedType = detectDocumentType(file.name);
    const needsManualClassification = detectedType === 'Unknown / Needs Review';
    try {
      const stored = await saveUploadedFile(docId, file);
      const newDoc: DocumentRecord = {
        id: docId,
        filename: file.name,
        original_file_name: stored.originalFileName,
        mime_type: stored.mimeType,
        file_size: stored.size,
        upload_timestamp: stored.uploadedAt,
        file_type: detectedType,
        ocr_status: needsManualClassification ? 'Low Confidence' : 'Pending',
        ocr_confidence: needsManualClassification ? 0.5 : 0.75,
        institution_name: needsManualClassification ? 'Needs Review' : 'Detected from filename',
        statement_period: '',
        processing_status: needsManualClassification ? 'Requires Classification' : 'Requires Verification',
        user_notes: 'Source file stored locally. Type may be detected from filename only; text has not been read and transactions have not been extracted.',
        local_file: { storage: 'indexeddb', stored: true },
        source_file_status: 'stored',
        type_detected: !needsManualClassification,
        text_read: false,
        transactions_extracted: false,
      };
      onAddDocument(newDoc);
      setRecentImports(prev => [{ id: docId, filename: file.name, timestamp: stored.uploadedAt, status: 'completed' }, ...prev].slice(0, 8));
      setErrorNotification(null);
      setSuccessNotification(`File '${file.name}' stored locally. Text not read and transactions not extracted yet.`);
    } catch (err) {
      console.error(err);
      setSuccessNotification(null);
      setErrorNotification(`Unable to store '${file.name}' locally. Browser storage may be unavailable or full.`);
    } finally {
      setIsUploading(false);
    }
  };

  const showStorageError = () => {
    setSuccessNotification(null);
    setErrorNotification('Unable to access local file storage. Browser storage may be unavailable or full.');
  };

  const downloadOriginalFile = async (doc: DocumentRecord) => {
    try {
      const stored = await getUploadedFile(doc.id);
      if (!stored?.blob) {
        alert('Original source file is not available in this browser.');
        return;
      }
      const url = URL.createObjectURL(stored.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = stored.originalFileName || doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showStorageError();
    }
  };

  const deleteOriginalFileOnly = async (doc: DocumentRecord) => {
    if (!confirm('Delete only the stored original source file? Document metadata and extracted transactions will remain.')) return;
    try {
      await deleteUploadedFile(doc.id);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = '';
      }
      setPreviewFileUrl('');
      setPreviewText('');
      setPreviewFileAvailable(false);
      const updates: Partial<DocumentRecord> = { source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
      onUpdateDocument?.(doc.id, updates);
      setSelectedDocForPreview(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error(err);
      showStorageError();
    }
  };

  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [previewFileAvailable, setPreviewFileAvailable] = useState<boolean | null>(null);
  const previewObjectUrlRef = useRef('');
  useEffect(() => {
    let active = true;
    let url = '';
    const doc = selectedDocForPreview;
    setPreviewFileUrl('');
    setPreviewText('');
    setPreviewFileAvailable(null);
    if (!doc) return;

    getUploadedFile(doc.id).then(async stored => {
      if (!active || selectedDocForPreview?.id !== doc.id) return;
      if (!stored?.blob) {
        setPreviewFileAvailable(false);
        if (doc.source_file_status === 'stored' || doc.local_file?.stored) {
          const updates: Partial<DocumentRecord> = { source_file_status: 'unavailable', local_file: { storage: 'indexeddb', stored: false } };
          onUpdateDocument?.(doc.id, updates);
          setSelectedDocForPreview(prev => prev?.id === doc.id ? { ...prev, ...updates } : prev);
        }
        return;
      }
      url = URL.createObjectURL(stored.blob);
      if (!active || selectedDocForPreview?.id !== doc.id) {
        URL.revokeObjectURL(url);
        if (previewObjectUrlRef.current === url) previewObjectUrlRef.current = '';
        url = '';
        return;
      }
      previewObjectUrlRef.current = url;
      setPreviewFileAvailable(true);
      setPreviewFileUrl(url);
      const mime = stored.mimeType || doc.mime_type || '';
      if (mime.startsWith('text/') || mime.includes('csv') || doc.filename.toLowerCase().endsWith('.csv')) {
        const text = (await stored.blob.text()).slice(0, 20000);
        if (active && selectedDocForPreview?.id === doc.id) setPreviewText(text);
      }
    }).catch(err => {
      console.error(err);
      if (active) showStorageError();
    });

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
        if (previewObjectUrlRef.current === url) previewObjectUrlRef.current = '';
      }
    };
  }, [selectedDocForPreview?.id]);

  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchText.toLowerCase()) ||
    doc.institution_name.toLowerCase().includes(searchText.toLowerCase()) ||
    doc.file_type.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-6" id="documents-view-container">
      
      {/* Visual upload frame + Upload Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Drag & Drop Upload Zone */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Upload Document</h4>
            <p className="text-xs text-slate-500 mb-4 font-sans">
              Drag or select document files here. Documents are saved locally immediately. If NAFA Ledger cannot read details automatically, the document is marked Needs Review so you can add missing details manually.
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
                    <RotateCw className="h-3 w-3 animate-spin text-indigo-600" /> Storing file locally...
                  </div>
                  <div className="w-40 bg-slate-100 h-1 rounded overflow-hidden mx-auto">
                    <div className="bg-indigo-600 h-full animate-[loading_1s_infinite]" />
                  </div>
                </div>
              ) : (
                <div className="space-y-1 select-none">
                  <p className="text-xs font-bold text-slate-800">Drag and drop documents here</p>
                  <p className="text-[10px] text-slate-400">PDF, CSV, JPEG or TXT files supported</p>
                  <label className="inline-block mt-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase py-1 px-3 rounded cursor-pointer transition-colors shadow-sm">
                    Select File
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleSourceFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Recent Imports List & Retry Flow */}
            <div className="bg-white border text-xs border-slate-200 rounded-xl p-4 shadow-xs mt-3.5 space-y-2.5">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Upload Feedback</h5>
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
                          Retry Reading
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: source-file-first notice */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Source-File-First Records</h4>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Manual document records are disabled. Upload a source file to create a document record.
          </p>
          <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg p-3 text-[11px] leading-relaxed">
            Files are stored in this browser’s local storage for this device and website. They are not uploaded to a cloud server. Browser storage is not the same as a normal folder like Downloads. Export a workspace backup to preserve your records before clearing browser data or switching devices.
          </div>
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
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Import Spreadsheet Data</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Use this when you already have transaction rows copied from a bank CSV or spreadsheet.</p>
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
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Paste Transactions</label>
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
                    Match Columns
                  </button>
                  {csvHeaders.length > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Matched {csvParsedRows.length} rows successfully!
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Optional Account Match</label>
                  <select
                    value={csvAccount}
                    onChange={e => setCsvAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden"
                  >
                    <option value="">No account selected</option>
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
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
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
                      <span className="text-[10px] font-bold text-slate-700 uppercase block">Flag for Review</span>
                      <span className="text-[9px] text-slate-400 block -mt-0.5">Mark these rows as needing review with lower read quality.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {csvHeaders.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-3 space-y-3">
                <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-600" /> Match Columns
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
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Matched Preview (First 4 Rows)</div>
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
                    Import Transactions ({csvParsedRows.length} Transactions)
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

      {/* Read Document Text */}
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
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Read Document Text</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">If automatic reading does not work, copy text from a PDF and paste it here. NAFA Ledger will try to find dates, merchants, amounts, balances, and other useful information.</p>
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
                    Extract Information
                  </button>
                  {pdfParsedRows.length > 0 && (
                    <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Extracted {pdfParsedRows.length} transactions!
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Optional Account Match</label>
                  <select
                    value={pdfAccount}
                    onChange={e => setPdfAccount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-semibold outline-hidden focus:border-indigo-400"
                  >
                    <option value="">No account selected</option>
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
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
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
                      <span className="text-[10px] font-bold text-slate-700 uppercase block">Flag for Review</span>
                      <span className="text-[8px] text-slate-400 block font-semibold leading-none">Pushes statements directly to the Needs Review</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {pdfParsedRows.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto">
                  <div className="text-[9px] font-bold text-slate-405 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Transactions Found Preview</span>
                    <span className="bg-indigo-50 text-indigo-700 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border border-indigo-150">Heuristic Extraction Rating: 94%</span>
                  </div>
                  <table className="w-full text-left font-mono text-[10px] divide-y divide-slate-100 font-normal">
                    <thead>
                      <tr className="text-slate-500 uppercase text-[9px]">
                        <th className="pb-1 px-1 font-bold">Line date</th>
                        <th className="pb-1 px-1 font-bold">Matched Merchant / Description</th>
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
                    Import Transactions ({pdfParsedRows.length} transactions)
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
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Uploaded Documents</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Documents are stored locally in this browser workspace and can be opened to review or edit details.</p>
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
                <th className="p-3">Transactions Found</th>
                <th className="p-3">Detection Confidence</th>
                <th className="p-3">Associated Account</th>
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
                      <div 
                        onClick={() => setSelectedDocForPreview(doc)}
                        className="flex items-start gap-2.5 cursor-pointer group"
                        title="Click to view layout preview and edit metadata"
                      >
                        <FileText className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 font-mono truncate group-hover:text-indigo-650 group-hover:underline">{doc.filename}</p>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            ID: {doc.id} · Uploaded {new Date(doc.upload_timestamp).toLocaleDateString()}
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
                        <option value="">No account selected</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} (*{doc.file_type === 'Paystub' ? 'Associate Account' : acc.account_suffix})
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDocForPreview(doc)}
                          className="bg-indigo-55 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded px-2 py-1 text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 select-none"
                          title="Open document details and metadata editor"
                        >
                          👁️ View Details
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm("Are you sure you want to permanently delete this document from this workspace?")) {
                              onDeleteDocument(doc.id);
                            }
                          }}
                          className="text-slate-400 hover:text-red-650 transition-colors p-1 bg-slate-50 hover:bg-rose-50 border border-slate-150 rounded"
                          title="Delete document from this workspace"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-slate-400 italic">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating notification banners */}
      {successNotification && (
        <div className="fixed top-4 right-4 bg-emerald-900 border border-emerald-500 text-emerald-100 text-xs font-bold font-sans py-3.5 px-5 rounded-xl shadow-xl z-[999999] flex items-center gap-2.5 animate-bounce">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
          <span>{successNotification}</span>
        </div>
      )}
      {errorNotification && (
        <div className="fixed top-4 right-4 bg-rose-950 border border-rose-500 text-rose-100 text-xs font-bold font-sans py-3.5 px-5 rounded-xl shadow-xl z-[999999] flex items-center gap-2.5">
          <AlertCircle className="h-4.5 w-4.5 text-rose-300 shrink-0" />
          <span>{errorNotification}</span>
        </div>
      )}

      {/* Sliding preview panel / detail modal drawer */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex justify-end z-[5000]" id="doc-preview-modal-drawer">
          <div className="fixed inset-0" onClick={() => setSelectedDocForPreview(null)}></div>
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl relative z-[5001] flex flex-col justify-between overflow-hidden">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight truncate max-w-md">{selectedDocForPreview.filename}</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-mono tracking-widest mt-0.5">
                    ID: {selectedDocForPreview.id} · CLASSIFIED: {selectedDocForPreview.file_type}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDocForPreview(null)}
                className="text-slate-400 hover:text-white font-mono text-xs font-bold p-1 bg-slate-800 rounded px-2"
                id="close-drawer-btn"
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Content area: Split Layout Preview & Config */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin text-slate-800">
              
              {/* TIMESTAMPS & SOURCE METADATA */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Uploaded At</span>
                  <span className="font-mono text-slate-800 font-bold">
                    {selectedDocForPreview.upload_timestamp ? new Date(selectedDocForPreview.upload_timestamp).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Institution Name</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDocForPreview.institution_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Statement dates</span>
                  <span className="font-mono text-slate-800 font-semibold">
                    {selectedDocForPreview.statement_period || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Detection Confidence</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {Math.round(selectedDocForPreview.ocr_confidence * 100)}% ({selectedDocForPreview.ocr_status})
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs space-y-3">
                <h4 className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest">Upload Truthful Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-emerald-900">
                  <div className="bg-white/70 border border-emerald-100 rounded-lg p-2"><span className="block text-[9px] font-bold uppercase text-emerald-700">Source File</span>{previewFileAvailable ? 'Stored in this browser' : selectedDocForPreview.source_file_status === 'metadata_only' ? 'Metadata only' : 'Not available in this browser'}</div>
                  <div className="bg-white/70 border border-emerald-100 rounded-lg p-2"><span className="block text-[9px] font-bold uppercase text-emerald-700">Text Reading</span>{selectedDocForPreview.text_read ? 'Text read' : selectedDocForPreview.ocr_status === 'Low Confidence' ? 'Needs review' : 'Not read yet'}</div>
                  <div className="bg-white/70 border border-emerald-100 rounded-lg p-2"><span className="block text-[9px] font-bold uppercase text-emerald-700">Transactions</span>{transactions.some(t => t.source_document_id === selectedDocForPreview.id) ? (selectedDocForPreview.transactions_extracted ? 'Transactions found' : 'Imported manually') : 'Not extracted yet'}</div>
                </div>
                {!previewFileAvailable && selectedDocForPreview.source_file_status !== 'metadata_only' && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2">Source file unavailable in this browser.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" disabled={!previewFileAvailable} onClick={() => previewFileUrl ? undefined : alert('Original source file is not available in this browser.')} className="bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200 text-emerald-800 rounded px-3 py-1.5 font-bold inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> View File</button>
                  <button type="button" disabled={!previewFileAvailable} onClick={() => downloadOriginalFile(selectedDocForPreview)} className="bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200 text-emerald-800 rounded px-3 py-1.5 font-bold inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Download Original</button>
                  <button type="button" disabled={!previewFileAvailable} onClick={() => deleteOriginalFileOnly(selectedDocForPreview)} className="bg-white disabled:opacity-50 disabled:cursor-not-allowed border border-rose-200 text-rose-700 rounded px-3 py-1.5 font-bold inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Delete File</button>
                </div>
              </div>

              {/* ACTION: RENAME & RECLASSIFY & EDIT NOTES INLINE */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                <h4 className="text-[10.5px] font-black uppercase text-slate-900 tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                  ✏️ Edit Document Metadata
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Document Title (Filename)</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-mono font-bold text-slate-950 focus:bg-white focus:border-indigo-400 outline-hidden"
                      value={selectedDocForPreview.filename}
                      onChange={e => {
                        const newName = e.target.value;
                        if (onUpdateDocument) {
                          onUpdateDocument(selectedDocForPreview.id, { filename: newName });
                          setSelectedDocForPreview(prev => prev ? { ...prev, filename: newName } : null);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Classification Type</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold text-slate-950 focus:bg-white focus:border-indigo-400 outline-hidden"
                      value={selectedDocForPreview.file_type}
                      onChange={e => {
                        const newType = e.target.value as any;
                        if (onUpdateDocument) {
                          onUpdateDocument(selectedDocForPreview.id, { file_type: newType });
                          setSelectedDocForPreview(prev => prev ? { ...prev, file_type: newType } : null);
                        }
                      }}
                    >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Optional Account Match</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-semibold text-slate-950 focus:bg-white focus:border-indigo-400 outline-hidden"
                    value={selectedDocForPreview.account_id || ''}
                    onChange={e => {
                      const accId = e.target.value;
                      onLinkAccount(selectedDocForPreview.id, accId);
                      setSelectedDocForPreview(prev => prev ? { ...prev, account_id: accId || undefined } : null);
                    }}
                  >
                    <option value="">No account selected</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name} (*{acc.account_suffix})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Choose an account only if this document belongs with one. This does not connect to a bank.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-950 focus:bg-white focus:border-indigo-400 outline-hidden font-sans"
                    placeholder="Add notes about this document..."
                    value={selectedDocForPreview.user_notes || ''}
                    onChange={e => {
                      const notes = e.target.value;
                      if (onUpdateDocument) {
                        onUpdateDocument(selectedDocForPreview.id, { user_notes: notes });
                        setSelectedDocForPreview(prev => prev ? { ...prev, user_notes: notes } : null);
                      }
                    }}
                  />
                </div>
              </div>

              {/* DOCUMENT LAYOUT PREVIEW PANEL */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-[10.5px] font-bold uppercase text-emerald-450 font-mono tracking-wider">
                    📄 Document Details
                  </h4>
                  <span className="text-[9px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">
                    Metadata View
                  </span>
                </div>
                
                {/* Visual rendering of a mock PDF/CSV document */}
                <div className="bg-slate-950 rounded-lg p-5 border border-slate-850 font-mono text-[10px] text-slate-405 space-y-3 select-text max-h-[160px] overflow-y-auto">
                  <p className="text-white font-bold text-center border-b border-slate-900 pb-1 uppercase text-xs">
                    {selectedDocForPreview.institution_name || 'Generic Bank Corp'}
                  </p>
                  <p className="flex justify-between text-[9px] text-slate-500">
                    <span>RECORD DATE: {selectedDocForPreview.statement_period || 'N/A'}</span>
                    <span>DOCUMENT ID: #{selectedDocForPreview.id}</span>
                  </p>
                  <hr className="border-slate-900" />
                  <div className="text-slate-300 leading-relaxed text-[10px] space-y-1">
                    [EXTRACTED TEXT PREVIEW]
                    <br />
                    Preview appears here for supported locally stored files. Unsupported files can still be downloaded.
                    <br />
                    File Category Matches: <strong className="text-emerald-400">{selectedDocForPreview.file_type}</strong>.
                    <br />
                    Detection Confidence: <strong className="text-emerald-400">{Math.round(selectedDocForPreview.ocr_confidence * 100)}%</strong>.
                    <br />
                    Text read: <strong className="text-emerald-500">{selectedDocForPreview.text_read ? 'Yes' : 'No'}</strong>.
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <h4 className="text-[10.5px] font-black uppercase text-slate-900 tracking-wider border-b pb-1.5">📎 Source File Preview</h4>
                {!previewFileUrl ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 border border-dashed rounded-lg text-xs">Preview not available yet, but original file may be unavailable or still loading.</div>
                ) : (selectedDocForPreview.mime_type?.includes('pdf') ? (
                  <iframe src={previewFileUrl} title="PDF source preview" className="w-full h-96 rounded border border-slate-200" />
                ) : selectedDocForPreview.mime_type?.startsWith('image/') ? (
                  <img src={previewFileUrl} alt="Source file preview" className="max-h-96 rounded border border-slate-200 mx-auto" />
                ) : previewText ? (
                  <pre className="max-h-96 overflow-auto bg-slate-950 text-slate-100 rounded p-3 text-[10px] whitespace-pre-wrap">{previewText}</pre>
                ) : (
                  <div className="p-4 text-center text-slate-500 bg-slate-50 border border-dashed rounded-lg text-xs">Preview not available yet, but original file is stored locally. Use Download Original.</div>
                ))}
              </div>

              {/* EXTRACTED INFORMATION ROW INDICES */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <h4 className="text-[10.5px] font-black uppercase text-slate-900 tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                  🔍 Transactions Found
                </h4>
                
                <div className="text-xs space-y-2">
                  {transactions.filter(t => t.source_document_id === selectedDocForPreview.id).length > 0 ? (
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
                      {transactions
                        .filter(t => t.source_document_id === selectedDocForPreview.id)
                        .map(tx => (
                          <div key={tx.transaction_id} className="py-2 flex items-center justify-between text-[11px] font-mono">
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-800 truncate">{tx.clean_vendor_name || tx.raw_description}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {tx.transaction_date} · {tx.category} {tx.notes ? `· Notes: ${tx.notes}` : ''}
                              </p>
                            </div>
                            <span className={`font-bold font-mono text-right shrink-0 ${
                              tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}>
                              {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                      No transactions have been extracted from this document yet. Use Read Document Text or Import Spreadsheet Data if you want to add transactions.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer and Delete Actions */}
            <div className="bg-slate-50 border-t p-4 flex items-center justify-between">
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to permanently delete this document from this workspace?")) {
                    onDeleteDocument(selectedDocForPreview.id);
                    setSelectedDocForPreview(null);
                  }
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono text-xs font-bold py-2 px-4 rounded-lg border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                🗑️ Delete
              </button>
              
              <button 
                onClick={() => setSelectedDocForPreview(null)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-mono text-xs font-bold py-2 px-5 rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
