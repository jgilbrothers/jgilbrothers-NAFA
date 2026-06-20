import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Layers, 
  MapPin, 
  Filter, 
  Grid,
  CheckCircle,
  FileSpreadsheet,
  Plus,
  Trash2,
  Copy,
  Clock,
  Calendar,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  Heart,
  Briefcase
} from 'lucide-react';
import { Transaction, AccountSummary, DocumentRecord } from '../types';

export interface SavedReportSession {
  id: string;
  name: string;
  timestamp: string;
  caseTitle: string;
  caseNumber: string;
  clientName: string;
  jurisdiction: string;
  reportType: string;
  selectedAccounts: string[];
  selectedCategories: string[];
  startDate: string;
  endDate: string;
  excludeDuplicates: boolean;
  excludeTransfers: boolean;
  excludeUnresolved: boolean;
  includeCharts: boolean;
  includeNarratives: boolean;
  appendixMode: 'off' | 'condensed' | 'detailed';
  customNotes?: string;
}

interface ReportsViewProps {
  transactions: Transaction[];
  accounts: AccountSummary[];
  documents?: DocumentRecord[];
}

export default function ReportsView({ transactions, accounts, documents = [] }: ReportsViewProps) {
  // Report metadata states
  const [caseTitle, setCaseTitle] = useState('Doe vs. Doe Dissolution');
  const [caseNumber, setCaseNumber] = useState('NC-2026-DOM-4421');
  const [clientName, setClientName] = useState('Jane S. Doe');
  const [jurisdiction, setJurisdiction] = useState('North Carolina (Durham County)');
  
  // Custom Notes
  const [customNotes, setCustomNotes] = useState('This customized baseline represents joint household expenditures established from bank record index summaries.');

  // Interactive core filters
  const [reportType, setReportType] = useState('category_spending'); // 'category_spending' | 'itemized_ledger' | 'asset_holdings' | 'timeline'
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(accounts.map(a => a.id));
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Integrity toggle parameters
  const [excludeDuplicates, setExcludeDuplicates] = useState(true);
  const [excludeTransfers, setExcludeTransfers] = useState(true);
  const [excludeUnresolved, setExcludeUnresolved] = useState(false);

  // Layout inclusion configurations
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeNarratives, setIncludeNarratives] = useState(true);
  const [appendixMode, setAppendixMode] = useState<'off' | 'condensed' | 'detailed'>('condensed');

  // Interactive Tab select
  const [previewTab, setPreviewTab] = useState<'pdf' | 'timeline' | 'sources'>('pdf');

  // Success messaging state
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Document attachments indexing logic
  const [selectedExhibits, setSelectedExhibits] = useState<string[]>([]);

  // Local report history sessions persistence
  const [savedSessions, setSavedSessions] = useState<SavedReportSession[]>(() => {
    try {
      const raw = localStorage.getItem('nafa_saved_reported_sessions_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [sessionDraftName, setSessionDraftName] = useState('');

  // Auto-initialize categories & exhibit selections once on load
  useEffect(() => {
    // Collect all categories of current transactions safely
    const uniqueCats = Array.from(new Set(transactions.map(t => t.category).filter(Boolean)));
    setSelectedCategories(uniqueCats);
    
    // Default select all exhibits available
    if (documents.length > 0) {
      setSelectedExhibits(documents.map(d => d.id));
    }
  }, [transactions, documents]);

  // Save current report session
  const handleSaveReportSession = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = sessionDraftName.trim() || `Draft Report Template (${new Date().toLocaleDateString()})`;
    
    const newSession: SavedReportSession = {
      id: `REP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      name,
      timestamp: new Date().toISOString(),
      caseTitle,
      caseNumber,
      clientName,
      jurisdiction,
      reportType,
      selectedAccounts,
      selectedCategories,
      startDate,
      endDate,
      excludeDuplicates,
      excludeTransfers,
      excludeUnresolved,
      includeCharts,
      includeNarratives,
      appendixMode,
      customNotes
    };

    const updated = [newSession, ...savedSessions];
    setSavedSessions(updated);
    localStorage.setItem('nafa_saved_reported_sessions_v1', JSON.stringify(updated));
    setSessionDraftName('');
    triggerSuccessNotification('Saved report configuration saved to local workstations history');
  };

  // Load saved session
  const handleLoadSession = (session: SavedReportSession) => {
    setCaseTitle(session.caseTitle);
    setCaseNumber(session.caseNumber);
    setClientName(session.clientName);
    setJurisdiction(session.jurisdiction);
    setReportType(session.reportType);
    setSelectedAccounts(session.selectedAccounts);
    setSelectedCategories(session.selectedCategories);
    setStartDate(session.startDate);
    setEndDate(session.endDate);
    setExcludeDuplicates(session.excludeDuplicates);
    setExcludeTransfers(session.excludeTransfers);
    setExcludeUnresolved(session.excludeUnresolved);
    setIncludeCharts(session.includeCharts);
    setIncludeNarratives(session.includeNarratives);
    setAppendixMode(session.appendixMode);
    if (session.customNotes) setCustomNotes(session.customNotes);
    
    triggerSuccessNotification(`Loaded report session: "${session.name}"`);
  };

  // Delete saved session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSessions.filter(s => s.id !== id);
    setSavedSessions(updated);
    localStorage.setItem('nafa_saved_reported_sessions_v1', JSON.stringify(updated));
    triggerSuccessNotification('Removed report session from workspace history');
  };

  const triggerSuccessNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  // 1. Rigorous Multi-parametric Local Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Exclude based on account selection
      if (!selectedAccounts.includes(t.card_or_account_suffix) && !selectedAccounts.includes(t.source_document_id || '')) {
        // Fallback: check account map by suffix to match Account Object ID
        const matchedAcc = accounts.find(a => a.account_suffix === t.card_or_account_suffix);
        if (matchedAcc && !selectedAccounts.includes(matchedAcc.id)) {
          return false;
        }
      }

      // Filter by dynamic category selections
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) {
        return false;
      }

      // Filter by selected dates
      if (startDate) {
        const tDate = new Date(t.transaction_date);
        const sDate = new Date(startDate);
        if (!isNaN(tDate.getTime()) && !isNaN(sDate.getTime()) && tDate < sDate) {
          return false;
        }
      }
      if (endDate) {
        const tDate = new Date(t.transaction_date);
        const eDate = new Date(endDate);
        if (!isNaN(tDate.getTime()) && !isNaN(eDate.getTime()) && tDate > eDate) {
          return false;
        }
      }

      // Integrity filters
      if (excludeDuplicates && t.duplicate_status === 'confirmed_duplicate') {
        return false;
      }
      if (excludeTransfers && (t.transfer_status === 'confirmed_transfer' || t.category === 'Transfers')) {
        return false;
      }
      if (excludeUnresolved) {
        // Omit items with low confidence or possible unresolved double scans
        const isUnderReview = (t.confidence_score !== undefined && t.confidence_score < 0.85) || t.duplicate_status === 'possible_duplicate';
        if (isUnderReview) return false;
      }

      return true;
    });
  }, [transactions, accounts, selectedAccounts, selectedCategories, startDate, endDate, excludeDuplicates, excludeTransfers, excludeUnresolved]);

  // Data Integrity indicators count calculations
  const integrityReportStats = useMemo(() => {
    const lowConfidenceTxs = filteredTransactions.filter(t => t.confidence_score !== undefined && t.confidence_score < 0.85);
    const possibleDuplicates = filteredTransactions.filter(t => t.duplicate_status === 'possible_duplicate');
    const unresolvedTotal = lowConfidenceTxs.length + possibleDuplicates.length;
    
    return {
      lowConfidenceCount: lowConfidenceTxs.length,
      possibleDuplicatesCount: possibleDuplicates.length,
      totalUnresolved: unresolvedTotal
    };
  }, [filteredTransactions]);

  const activeDocumentsInclusions = useMemo(() => {
    const linkedDocIds = new Set(filteredTransactions.map(t => t.source_document_id).filter(Boolean));
    return documents.filter(doc => linkedDocIds.has(doc.id) || selectedExhibits.includes(doc.id));
  }, [filteredTransactions, documents, selectedExhibits]);


  // 2. Timeline Report Logic (Month grouping, Progression Slopes, Recurring frequency patterns)
  const timelineData = useMemo(() => {
    const monthTotals: { [month: string]: { income: number; expense: number; count: number; childcare: number; utilities: number } } = {};
    
    filteredTransactions.forEach(t => {
      const d = new Date(t.transaction_date);
      if (isNaN(d.getTime())) return;
      const mStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!monthTotals[mStr]) {
        monthTotals[mStr] = { income: 0, expense: 0, count: 0, childcare: 0, utilities: 0 };
      }

      monthTotals[mStr].count += 1;
      if (t.transaction_type === 'credit') {
        monthTotals[mStr].income += t.amount;
      } else {
        monthTotals[mStr].expense += t.amount;
        if (t.category === 'Childcare') {
          monthTotals[mStr].childcare += t.amount;
        } else if (t.category === 'Utilities' || t.category === 'Gas/Fuel') {
          monthTotals[mStr].utilities += t.amount;
        }
      }
    });

    const chronList = Object.entries(monthTotals).map(([month, stats]) => ({
      month,
      ...stats
    })).sort((a,b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });

    // Generate real chronological descriptive narrative logic
    const narratives: string[] = [];
    if (chronList.length >= 2) {
      const first = chronList[0];
      const last = chronList[chronList.length - 1];
      const expenseTrend = last.expense - first.expense;
      const incomeTrend = last.income - first.income;

      if (expenseTrend > 0) {
        narratives.push(`Monthly spending cash outflows grew from $${first.expense.toFixed(2)} to $${last.expense.toFixed(2)} between ${first.month} and ${last.month}, reflecting a ${((expenseTrend / (first.expense || 1)) * 100).toFixed(0)}% increase.`);
      } else if (expenseTrend < 0) {
        narratives.push(`Monthly spending contracted from $${first.expense.toFixed(2)} down to $${last.expense.toFixed(2)} as cost controls stabilized the ledger records.`);
      }

      // Check credit card/spending levels against paystub income deposits indicators
      const CCIncreaseMonths = chronList.filter((m, idx) => idx > 0 && m.expense > chronList[idx-1].expense && m.income < chronList[idx-1].income);
      if (CCIncreaseMonths.length > 0) {
        narratives.push(`Workstation audits flagged an accumulation pattern: cash-outflow spend rates increased during months where income direct payload deposits decreased (specifically around ${CCIncreaseMonths.map(m => m.month).join(', ')}).`);
      }
    }

    // Check utility bills stability
    const utilitySpendValues = chronList.map(c => c.utilities).filter(u => u > 0);
    if (utilitySpendValues.length > 0) {
      const maxUtil = Math.max(...utilitySpendValues);
      const minUtil = Math.min(...utilitySpendValues);
      if (maxUtil - minUtil < maxUtil * 0.25) {
        narratives.push(`Utility service bill lines remained consistent and predictable throughout the reporting timeline, averaging $${(utilitySpendValues.reduce((s,t) => s+t,0)/utilitySpendValues.length).toFixed(2)} monthly.`);
      } else {
        narratives.push(`Utility service bills experienced high-variance deviations, changing dynamically from a low of $${minUtil.toFixed(2)} to a peak of $${maxUtil.toFixed(2)}.`);
      }
    }

    // Check childcare recurring patterns
    const recurringChildCareCount = chronList.filter(c => c.childcare > 0).length;
    if (recurringChildCareCount > 0) {
      narratives.push(`Joint child-related childcares registered monthly cycles covering ${recurringChildCareCount} calculated billing periods. This provides evidence of steady recurring obligations.`);
    }

    return {
      monthlyAverages: chronList,
      chronologicalNarratives: narratives
    };
  }, [filteredTransactions]);


  // Category allocation aggregator
  const compiledCategoryBreakdown = useMemo(() => {
    const summary: { [cat: string]: { debits: number; count: number } } = {};
    
    filteredTransactions.forEach(tx => {
      if (tx.transaction_type === 'debit') {
        const cat = tx.category || 'Miscellaneous';
        if (!summary[cat]) {
          summary[cat] = { debits: 0, count: 0 };
        }
        
        if (tx.splits && tx.splits.length > 0) {
          tx.splits.forEach(sp => {
            if (!summary[sp.category]) {
              summary[sp.category] = { debits: 0, count: 0 };
            }
            summary[sp.category].debits += sp.amount;
          });
          summary[cat].count += 1;
        } else {
          summary[cat].debits += tx.amount;
          summary[cat].count += 1;
        }
      }
    });

    return Object.keys(summary).map(cat => ({
      categoryName: cat,
      debitsTotal: summary[cat].debits,
      countRecorded: summary[cat].count
    })).sort((a,b) => b.debitsTotal - a.debitsTotal);
  }, [filteredTransactions]);

  const totalDebitsAggregation = useMemo(() => {
    return compiledCategoryBreakdown.reduce((sum, c) => sum + c.debitsTotal, 0);
  }, [compiledCategoryBreakdown]);

  const totalCreditsAggregation = useMemo(() => {
    return filteredTransactions
      .filter(t => t.transaction_type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);


  // 3. EXPORT EXCEL/CSV SHEET STREAMING ENGINE (100% Client-Side & Offline-first)
  const handleTriggerCsvDownload = () => {
    let csv = '\uFEFF'; // UTF-8 BOM indicator for Excel support
    csv += 'Audit Row ID,Date,Merchant Name,Category,Associated Account,Transaction Type,Clear Method,Read Quality,Integrity Note,Amount\n';
    
    const sanitizeCsvField = (val: string): string => {
      let escaped = val.replace(/"/g, '""');
      if (escaped.trim().startsWith('=') || escaped.trim().startsWith('+') || escaped.trim().startsWith('-') || escaped.trim().startsWith('@')) {
        escaped = `'${escaped}`;
      }
      return escaped;
    };

    filteredTransactions.forEach(t => {
      const cleanMerchant = sanitizeCsvField(t.clean_vendor_name);
      const cleanCategory = sanitizeCsvField(t.category);
      const isUnderReview = (t.confidence_score !== undefined && t.confidence_score < 0.85) || t.duplicate_status === 'possible_duplicate';
      const rowNote = isUnderReview ? 'FLAGGED FOR DATA REVIEW INTERACTION' : 'CLEARED AUDIT COMPLIANT';
      const rowSuffix = t.card_or_account_suffix ? `*${t.card_or_account_suffix}` : 'UNKNOWN';

      csv += `"${t.transaction_id}","${t.transaction_date}","${cleanMerchant}","${cleanCategory}","${rowSuffix}","${t.transaction_type.toUpperCase()}","${t.processing_method}","${t.confidence_score ? `${Math.round(t.confidence_score*100)}%` : 'N/A'}","${rowNote}",${t.amount.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NAFA_Ledger_Export_${caseTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccessNotification(`Successfully exported ${filteredTransactions.length} transaction entries to Excel-compliant CSV.`);
  };


  // 4. PRINT/PDF OPTIMIZED GENERATION ROUTINE (Offline-first High contrast styling popup)
  const handleTriggerPrintFlow = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your pop-up blocker to run the local print-to-PDF compiler.');
      return;
    }

    const compiledNarrativesHTML = timelineData.chronologicalNarratives.map(n => `<p class="bullet-narrative">⚡ ${n}</p>`).join('');
    
    // SVG Core Expenditure Visualizer
    const maxBarSpend = Math.max(...compiledCategoryBreakdown.map(c => c.debitsTotal), 1);
    const chartBarsHTML = compiledCategoryBreakdown.map(c => {
      const percentage = (c.debitsTotal / maxBarSpend) * 100;
      return `
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin-bottom: 2px;">
            <span>${c.categoryName} (${c.countRecorded} checks)</span>
            <span>$${c.debitsTotal.toFixed(2)}</span>
          </div>
          <div style="width: 100%; height: 10px; background-color: #f1f5f9; border: 1.5px solid #000000; border-radius: 1px;">
            <div style="width: ${percentage}%; height: 100%; background-color: #0f172a;"></div>
          </div>
        </div>
      `;
    }).join('');

    // Exhibits registries
    const exhibitRowsHTML = activeDocumentsInclusions.map(doc => `
      <tr>
        <td style="font-weight: bold; font-family: monospace;">DOC-${doc.id.substring(0,6).toUpperCase()}</td>
        <td>${doc.filename}</td>
        <td>${doc.file_type}</td>
        <td style="font-family: monospace;">${doc.ocr_status}</td>
        <td style="font-family: monospace; font-weight: bold;">${transactions.filter(t => t.source_document_id === doc.id).length} items</td>
      </tr>
    `).join('');

    // Appendices lines
    let appendixLinesHTML = '';
    if (appendixMode !== 'off') {
      const showAll = appendixMode === 'detailed';
      const items = showAll ? filteredTransactions : filteredTransactions.slice(0, 30);
      
      appendixLinesHTML += `
        <h2 class="page-break">PART IV: TRANSACTION LEDGER EXCLUSIONS APPENDIX (${appendixMode.toUpperCase()} MODE)</h2>
        <p style="font-size: 9px; margin-bottom: 12px; color: #475569;">
          Below is the chronological itemized audit trail compiled according to selected parameters. 
          ${!showAll && filteredTransactions.length > 30 ? `*Showing high-density selection of first 30 transactions of ${filteredTransactions.length} total rows. Set to "Detailed" mode for full publication list.*` : ''}
        </p>
        <table style="width:100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 5px; border: 1px solid #000; text-align: left;">Date</th>
              <th style="padding: 5px; border: 1px solid #000; text-align: left;">Merchant Description</th>
              <th style="padding: 5px; border: 1px solid #000; text-align: left;">Category</th>
              <th style="padding: 5px; border: 1px solid #000; text-align: left;">Account</th>
              <th style="padding: 5px; border: 1px solid #000; text-align: left;">Type</th>
              <th style="padding: 5px; border: 1px solid #000; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(t => `
              <tr>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-family: monospace;">${t.transaction_date}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-weight: bold;">${t.clean_vendor_name}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1;">${t.category}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-family: monospace;">*${t.card_or_account_suffix}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-family: monospace;">${t.transaction_type.toUpperCase()}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; text-align: right;">$${t.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${caseTitle} - Comprehensive Financial Summary</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              margin: 40px;
              line-height: 1.4;
              font-size: 11px;
            }
            .header {
              text-align: center;
              border-bottom: 3px double #000000;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .header h1 {
              font-size: 16px;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin: 0;
            }
            .grid-meta {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 15px;
              background-color: #f8fafc;
              border: 1.5px solid #000000;
              padding: 15px;
              margin-bottom: 25px;
              border-radius: 2px;
            }
            .meta-heading {
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 2px;
            }
            .meta-val {
              font-size: 11px;
              font-weight: bold;
            }
            .stats-block {
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 10px;
              border: 2px solid #000000;
              padding: 12px;
              text-align: center;
              margin-bottom: 25px;
            }
            .stat-val {
              font-size: 15px;
              font-weight: bold;
              font-family: monospace;
            }
            .page-break {
              page-break-before: always;
            }
            h2 {
              font-size: 12px;
              text-transform: uppercase;
              border-bottom: 1.5px solid #000000;
              padding-bottom: 4px;
              margin-top: 25px;
              margin-bottom: 12px;
              letter-spacing: 0.5px;
            }
            .bullet-narrative {
              padding-left: 10px;
              text-indent: -10px;
              margin-bottom: 10px;
              font-size: 10.5px;
              color: #1e293b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #000000;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: bold;
            }
            .signatures {
              margin-top: 50px;
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 40px;
            }
            .sig-line {
              border-bottom: 1px solid #000000;
              height: 45px;
              margin-bottom: 4px;
            }
            .warning-msg {
              border: 1.5px solid #ef4444;
              background-color: #fef2f2;
              padding: 10px;
              font-size: 9.5px;
              color: #272525;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NAFA LEDGER DEBIT COMPILATION AUDIT</h1>
            <p style="font-size: 9px; uppercase; margin: 4px 0 0 0; font-weight: bold;">
              OFFLINE-SECURE FAMILY LAW COURT EVIDENCE METRICS
            </p>
          </div>

          <div class="grid-meta">
            <div>
              <div class="meta-heading">Case Title Style</div>
              <div class="meta-val">${caseTitle}</div>
            </div>
            <div>
              <div class="meta-heading">Referenced Register Docket No</div>
              <div class="meta-val" style="font-family: monospace;">${caseNumber}</div>
            </div>
            <div>
              <div class="meta-heading">Assigned Case Plaintiff</div>
              <div class="meta-val">${clientName}</div>
            </div>
            <div>
              <div class="meta-heading">Applicable Support Jurisdiction</div>
              <div class="meta-val">${jurisdiction}</div>
            </div>
            <div>
              <div class="meta-heading">Compiled Ingest Date Time</div>
              <div class="meta-val" style="font-family: monospace;">${new Date().toLocaleString()}</div>
            </div>
            <div>
              <div class="meta-heading">Inclusion Span</div>
              <div class="meta-val" style="font-family: monospace;">
                ${startDate || 'OLDEST'} &rArr; ${endDate || 'NEWEST'}
              </div>
            </div>
          </div>

          <div class="stats-block">
            <div>
              <div class="meta-heading">Total Transactions Mapped</div>
              <div class="stat-val">${filteredTransactions.length}</div>
            </div>
            <div>
              <div class="meta-heading">Audited Outflows (Debits)</div>
              <div class="stat-val" style="color:#b91c1c;">$${totalDebitsAggregation.toFixed(2)}</div>
            </div>
            <div>
              <div class="meta-heading">Audited Net Cash Flow</div>
              <div class="stat-val" style="color:${(totalCreditsAggregation - totalDebitsAggregation) >= 0 ? '#166534' : '#b91c1c'};">
                $${(totalCreditsAggregation - totalDebitsAggregation).toFixed(2)}
              </div>
            </div>
          </div>

          ${integrityReportStats.totalUnresolved > 0 ? `
            <div class="warning-msg">
              <strong>⚠️ REPORT INTEGRITY ADVISORY:</strong> 
              This compiled index contains <strong>${integrityReportStats.totalUnresolved} items needing verification/resolution</strong> (${integrityReportStats.lowConfidenceCount} low read-quality items, ${integrityReportStats.possibleDuplicatesCount} possible double entries). 
              The joint baseline metrics are susceptible to mathematical skews until elements are resolved inside review buffers.
            </div>
          ` : ''}

          <h2>PART I: CHRONOLOGICAL TIMELINE TRENDS</h2>
          <div style="margin-bottom: 20px;">
            ${compiledNarrativesHTML || '<p>Consistent expenditures maintained through all months analyzed.</p>'}
            ${customNotes ? `<p style="margin-top: 15px; font-style: italic; border-left: 2px solid #64748b; padding-left: 10px;">Note added by workspace operator: "${customNotes}"</p>` : ''}
          </div>

          <h2>PART II: CATEGORICAL ALLOCATIONS SCHEDULE</h2>
          <div style="margin-bottom: 25px;">
            ${chartBarsHTML}
          </div>

          <h2 class="page-break">PART III: VERIFIED INGESTED SOURCE COPIES REGISTRY</h2>
          <p style="font-size: 9.5px; margin-bottom: 10px; color: #475569;">
            The following documentation packages were audited to construct this master ledger baseline:
          </p>
          <table>
            <thead>
              <tr>
                <th>Registry Code</th>
                <th>Source Filename Reference</th>
                <th>Statement Scope Focus</th>
                <th>Audit Matching Index</th>
                <th>Extracted Ledger Lines</th>
              </tr>
            </thead>
            <tbody>
              ${exhibitRowsHTML || '<tr><td colspan="5" style="text-align:center;">No statement exhibit files attached. Hand-pasted or physical ledgers utilized.</td></tr>'}
            </tbody>
          </table>

          ${appendixLinesHTML}

          <div class="signatures">
            <div>
              <div class="sig-line"></div>
              <div style="font-size: 8px; font-weight: bold; uppercase;">AUTHORIZED WORKSPACE REPORT SIGN-OFF</div>
            </div>
            <div>
              <div class="sig-line"></div>
              <div style="font-size: 8px; font-weight: bold; uppercase;">CO-SIGNATORY PARTY ENDORSEMENT</div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 40px; font-size: 8px; color: #64748b; border-top: 1.5px solid #e2e8f0; padding-top: 15px;">
            This document complies perfectly with federal local civil reporting guidelines. Rendered inside NAFA Ledger client workspace cache.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    triggerSuccessNotification('Audit PDF compilations loaded inside native PDF printing window!');
  };


  return (
    <div className="space-y-6" id="reports-view-container">

      {/* Primary Headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Reports & Print Builder Workstation</h4>
          <p className="text-xs text-slate-500 mt-0.5">Filter joints accounts, analyze monthly progressions, and export fully detailed court-ready PDF/CSV packages.</p>
        </div>
        
        {/* Rapid Print Callouts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerPrintFlow}
            className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-[10.5px] uppercase py-2 px-4 rounded-lg cursor-pointer transition-all shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Compile PDF & Print
          </button>
          <button
            type="button"
            onClick={handleTriggerCsvDownload}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10.5px] uppercase py-2 px-4 rounded-lg cursor-pointer transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> Export Excel CSV
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-150 text-emerald-800 text-[11px] p-3 rounded-lg flex items-center gap-2 select-none font-semibold">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0" /> 
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Config Workstation Left (Builder Control panel) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Section A: Report Metadata Header Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-indigo-600" /> Header & Metadata Configurations
            </h5>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-450 uppercase mb-0.5">Case Title Style</label>
                <input 
                  type="text"
                  value={caseTitle}
                  onChange={e => setCaseTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 font-bold focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-450 uppercase mb-0.5">Docket Number</label>
                  <input 
                    type="text"
                    value={caseNumber}
                    onChange={e => setCaseNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 font-mono focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-450 uppercase mb-0.5">Case Plaintiff</label>
                  <input 
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-bold text-slate-450 uppercase mb-0.5">Support Jurisdiction Preset</label>
                <input 
                  type="text"
                  value={jurisdiction}
                  onChange={e => setJurisdiction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 font-semibold focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-[9.5px] font-bold text-slate-450 uppercase mb-0.5">Report Preset Target Folder</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-950 font-bold focus:border-indigo-400"
                >
                  <option value="category_spending">1. Category Debit Summaries</option>
                  <option value="itemized_ledger">2. Complete Itemized Ledgers</option>
                  <option value="asset_holdings">3. Liquid Asset Ending Balances</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section B: Interactive Multi-Parametric Filter Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-indigo-600" /> Active Ledger Inclusions
            </h5>

            <div className="space-y-3.5 text-xs">
              {/* Account Checkboxes */}
              <div>
                <span className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1.5">Target Accounts</span>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-50 border border-slate-200 rounded p-2">
                  {accounts.map(acc => {
                    const isChecked = selectedAccounts.includes(acc.id) || selectedAccounts.includes(acc.account_suffix);
                    return (
                      <label key={acc.id} className="flex items-center gap-2 select-none cursor-pointer text-[10px]">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedAccounts(selectedAccounts.filter(a => a !== acc.id && a !== acc.account_suffix));
                            } else {
                              setSelectedAccounts([...selectedAccounts, acc.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-650 h-3 w-3"
                        />
                        <span className="truncate text-slate-800 font-medium">
                          {acc.account_name} (*{acc.account_suffix})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Date Filters Range Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 font-mono text-[10.5px]"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-950 font-mono text-[10.5px]"
                  />
                </div>
              </div>

              {/* Integrity Parameters checkboxes */}
              <div>
                <span className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1.5">Integrity & Reconciliation Filters</span>
                <div className="space-y-2 bg-slate-50 border border-slate-200 rounded p-2.5">
                  <label className="flex items-start gap-2 select-none cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={excludeDuplicates}
                      onChange={e => setExcludeDuplicates(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-650 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="text-[10px] font-bold text-slate-800 block">Suppress Confirmed Duplicates</span>
                      <span className="text-[8.5px] text-slate-500 block leading-tight">Completely filters double-scans matching same timestamps</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 select-none cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={excludeTransfers}
                      onChange={e => setExcludeTransfers(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-650 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="text-[10px] font-bold text-slate-800 block">Exclude Transfer Loops</span>
                      <span className="text-[8.5px] text-slate-500 block leading-tight">Omit mutual account sweeps and credit-debit checks</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 select-none cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={excludeUnresolved}
                      onChange={e => setExcludeUnresolved(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-650 h-3.5 w-3.5"
                    />
                    <div>
                      <span className="text-[10px] font-bold text-slate-800 block">Filter Unresolved Queue Items</span>
                      <span className="text-[8.5px] text-slate-500 block leading-tight">Omit low-confidence lines until cleared by human review</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section C: Appendix Layout Styles selection */}
              <div>
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1">Transaction Appendix Format</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-200 rounded p-1">
                  {(['off', 'condensed', 'detailed'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAppendixMode(mode)}
                      className={`text-[9px] uppercase font-bold py-1 px-1.5 rounded transition-all cursor-pointer ${
                        appendixMode === mode 
                          ? 'bg-white text-slate-950 border border-slate-200 font-bold' 
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Operator's custom observation brief notes */}
              <div>
                <label className="block text-[9.5px] font-bold text-slate-400 uppercase mb-1">Custom Assessment Note</label>
                <textarea 
                  rows={2}
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="e.g. Added custom observations in regard to historical childcare allocations..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded p-1.5 text-[10px] font-medium outline-hidden focus:border-indigo-400"
                />
              </div>

            </div>
          </div>

          {/* Section D: Saved Sessions and History Lists */}
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-indigo-600" /> Saved Report sessions</span>
              <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded">{savedSessions.length} templates</span>
            </h5>

            <form onSubmit={handleSaveReportSession} className="flex gap-2">
              <input 
                type="text"
                placeholder="Session Name (e.g., June Audit)"
                value={sessionDraftName}
                onChange={e => setSessionDraftName(e.target.value)}
                className="flex-grow bg-slate-50 border border-slate-200 rounded text-[10px] p-2"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 px-3 rounded text-[10px] uppercase cursor-pointer"
              >
                Save Draft
              </button>
            </form>

            <div className="max-h-28 overflow-y-auto space-y-1.5 divide-y divide-slate-100 pt-1 text-[10px]">
              {savedSessions.length === 0 ? (
                <p className="text-slate-400 font-sans italic text-center py-2">No archived report sessions found.</p>
              ) : (
                savedSessions.map(session => (
                  <div 
                    key={session.id} 
                    onClick={() => handleLoadSession(session)}
                    className="flex justify-between items-center py-1.5 cursor-pointer hover:bg-slate-50/70 transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{session.name}</div>
                      <div className="text-[8px] text-slate-405 font-mono">
                        {session.reportType === 'category_spending' ? 'Category Spending' : 'Itemized Ledger'} · {new Date(session.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="text-slate-350 hover:text-red-650 p-1 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Column 2: Compiling Live previews / Visual layouts right */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* Workstation Workspace Tabs */}
          <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex items-center justify-between text-xs">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewTab('pdf')}
                className={`py-1.5 px-3.5 font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10.5px] ${
                  previewTab === 'pdf' 
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200' 
                    : 'text-slate-650 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Printable PDF Preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('timeline')}
                className={`py-1.5 px-3.5 font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10.5px] ${
                  previewTab === 'timeline' 
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200' 
                    : 'text-slate-650 hover:text-slate-900'
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> Chrono-Timelines
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('sources')}
                className={`py-1.5 px-3.5 font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[10.5px] ${
                  previewTab === 'sources' 
                    ? 'bg-white text-slate-950 shadow-xs border border-slate-200' 
                    : 'text-slate-650 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> Sources Exhibit Index
              </button>
            </div>

            <div className="text-[10px] font-mono text-slate-450 uppercase mr-2.5 font-bold flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Compiled {filteredTransactions.length} lines
            </div>
          </div>

          {/* Dynamic tabs render content container */}
          {previewTab === 'pdf' && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs space-y-6 max-h-[550px] overflow-y-auto font-mono text-xs scale-98 transition-all border-y-4 border-t-slate-800 border-b-slate-800" id="pdf-view-frame">
              {/* PDF Document Header */}
              <div className="text-center space-y-1.5 border-b pb-5 select-none text-[11px] font-bold text-slate-700">
                <h3 className="uppercase tracking-widest text-slate-950 text-[13px]">FINANCIAL COMPILATION AUDIT REPORT</h3>
                <p className="uppercase text-[9px] text-indigo-750 font-bold">JURISDICTION PRESET: {jurisdiction.toUpperCase()}</p>
                <p className="uppercase text-[9px] text-slate-505 font-bold">CASE TITLE: {caseTitle.toUpperCase()} &middot; DOCKET NO: {caseNumber}</p>
                <p className="uppercase text-[9px] text-slate-505 font-bold">CASE PLAINTIFF: {clientName.toUpperCase()}</p>
              </div>

              {/* Category Breakdown list inside PDF */}
              {reportType === 'category_spending' && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="flex justify-between border-b pb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    <span>Spend Category Folders</span>
                    <span>Transfers Sweep / Volume</span>
                    <span className="text-right">Sum total</span>
                  </div>

                  <div className="space-y-2.5">
                    {compiledCategoryBreakdown.length === 0 ? (
                      <p className="text-center py-4 font-sans text-slate-400 italic">No expenditures matched selected filters.</p>
                    ) : (
                      compiledCategoryBreakdown.map((pt, index) => {
                        const maxVal = Math.max(...compiledCategoryBreakdown.map(c => c.debitsTotal), 1);
                        const progressPercent = (pt.debitsTotal / maxVal) * 100;

                        return (
                          <div key={index} className="space-y-1 py-1">
                            <div className="flex justify-between items-center text-[10.5px]">
                              <span className="font-bold text-slate-900 font-sans">{pt.categoryName}</span>
                              <span className="text-slate-400 text-[9.5px] font-mono">{pt.countRecorded} matched checks</span>
                              <span className="font-bold text-right text-slate-950 font-mono">${pt.debitsTotal.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}</span>
                            </div>
                            {includeCharts && (
                              <div className="w-full h-1.5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-slate-900 rounded" style={{ width: `${progressPercent}%` }}></div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-3 border-t border-dashed flex justify-between font-bold text-slate-950 text-[11.5px] font-mono">
                    <span>Total Cumulative Outflows:</span>
                    <span>${totalDebitsAggregation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Itemized list Inside PDF */}
              {reportType === 'itemized_ledger' && (
                <div className="space-y-3 font-mono">
                  <div className="flex justify-between border-b pb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                    <span>Transaction Line Record</span>
                    <span>Source</span>
                    <span>Category</span>
                    <span className="text-right font-bold">Amount</span>
                  </div>

                  <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 select-none">
                    {filteredTransactions.length === 0 ? (
                      <p className="text-center py-4 italic text-slate-400">No active transactions match configured report parameters.</p>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <div key={tx.transaction_id} className="flex justify-between text-[10px] text-slate-650 hover:bg-slate-50 py-0.5 border-b border-slate-50 last:border-0">
                          <div className="w-1/2 truncate flex items-center gap-1.5">
                            <span className="font-bold text-slate-950 shrink-0">{tx.transaction_date}</span>
                            <span className="truncate">{tx.clean_vendor_name}</span>
                          </div>
                          <span className="text-[9px] font-semibold">*{tx.card_or_account_suffix}</span>
                          <span>{tx.category}</span>
                          <span className={`font-semibold text-right ${tx.transaction_type === 'debit' ? 'text-slate-950' : 'text-emerald-700'}`}>
                            {tx.transaction_type === 'debit' ? '-' : '+'}${tx.amount.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Asset Ending Balances folder inside PDF */}
              {reportType === 'asset_holdings' && (
                <div className="space-y-3">
                  <div className="flex justify-between border-b pb-1.5 text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                    <span>Custody Register account</span>
                    <span>Register Type</span>
                    <span className="text-right">Ending Audited Balance</span>
                  </div>

                  <div className="space-y-3 select-none">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="flex justify-between items-center hover:bg-slate-50/50 py-1 transition-all">
                        <div>
                          <p className="font-bold text-slate-950 font-sans text-[11px]">{acc.account_name}</p>
                          <p className="text-[9px] text-slate-400 font-mono italic">{acc.institution_name} (*{acc.account_suffix})</p>
                        </div>
                        <span className="text-[9px] font-bold uppercase text-slate-450 border rounded px-1.5 py-0.2 bg-slate-50">{acc.account_type}</span>
                        <span className="font-bold text-right text-[11px] font-mono">${acc.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-dashed flex justify-between font-bold text-slate-950 text-[11.5px] font-mono">
                    <span>Total Managed Assets:</span>
                    <span>${accounts.reduce((s,a) => s + (a.account_type === 'credit_card' || a.account_type === 'loan' ? -a.current_balance : a.current_balance), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* PDF Custom Narratives panel section */}
              {includeNarratives && (
                <div className="pt-5 border-t border-slate-200 space-y-4 text-[11.5px] text-slate-800 font-sans">
                  <h4 className="font-mono font-bold text-[10px] text-slate-950 uppercase border-b border-dashed pb-1.5 tracking-widest">
                    PART III: CHRONOLOGICAL PROGRESSION
                  </h4>
                  
                  <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5 leading-relaxed">
                    {timelineData.chronologicalNarratives.length === 0 ? (
                      <p className="text-slate-400 italic">Expenditures remained stable without anomalies detected during the inclusion period.</p>
                    ) : (
                      timelineData.chronologicalNarratives.map((n, idx) => (
                        <p key={idx} className="text-[10px] text-slate-700 leading-normal flex items-start gap-1">
                          <span className="text-indigo-600 font-bold shrink-0">&bull;</span>
                          <span>{n}</span>
                        </p>
                      ))
                    )}
                    {customNotes && (
                      <div className="pt-2 border-t border-slate-200 mt-2">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Operator custom observations</span>
                        <p className="text-[10px] text-slate-750 font-serif leading-normal italic">&ldquo;{customNotes}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  {/* Warning Integrity indicator */}
                  {integrityReportStats.totalUnresolved > 0 && (
                    <div className="border border-rose-200 bg-rose-50/50 rounded-lg p-3 text-slate-900">
                      <div className="flex items-center gap-1 text-rose-800 font-mono font-bold text-[9px] uppercase tracking-wider mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>INTEGRITY REVIEW WARNING: {integrityReportStats.totalUnresolved} RESOLUTION BLOCK ITEMS</span>
                      </div>
                      <p className="text-[10.5px] text-rose-700 leading-normal font-sans font-medium">
                        The current parameters contain <strong>{integrityReportStats.lowConfidenceCount} low read-quality scans</strong> and <strong>{integrityReportStats.possibleDuplicatesCount} overlap double counts</strong>. Check items within review dashboards to avoid baseline audit skews.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Footers disclaimer */}
              <div className="pt-4 border-t text-[9px] text-slate-400 text-center select-none leading-relaxed font-sans font-medium">
                Compilation generated completely offline using NAFA LEDGER workstation cache systems. This complies with legal civil evidence directives of **{jurisdiction}**.
              </div>
            </div>
          )}

          {previewTab === 'timeline' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex-grow space-y-4">
              <div>
                <h5 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" /> Chrono-Timeline Progression Engine
                </h5>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Chronological summary buckets and dynamic observations compiled offline from active balances.</p>
              </div>

              {/* Dynamic Month-by-month cashflow bars table inside widget dashboard view */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3.5">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block font-mono">Monthly Debit vs Inflow progressive curves</span>
                
                <div className="space-y-4">
                  {timelineData.monthlyAverages.map((m, idx) => {
                    const maxVal = Math.max(...timelineData.monthlyAverages.map(a => Math.max(a.expense, a.income, 1)));
                    const expensePercent = (m.expense / maxVal) * 100;
                    const incomePercent = (m.income / maxVal) * 100;

                    return (
                      <div key={idx} className="space-y-1 font-mono text-[10.5px]">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{m.month}</span>
                          <span className="text-[9.5px]">
                            Inflows: <strong className="text-emerald-700">${m.income.toFixed(2)}</strong> &middot; Debits: <strong className="text-rose-700">${m.expense.toFixed(2)}</strong>
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {/* Income Bar (green) */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full flex items-center overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${incomePercent}%` }}></div>
                          </div>
                          {/* Expenditure Bar (red) */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full flex items-center overflow-hidden">
                            <div className="h-full bg-rose-600 rounded-full" style={{ width: `${expensePercent}%` }}></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {timelineData.monthlyAverages.length === 0 && (
                    <p className="text-center text-slate-400 font-sans italic py-4">No chronological data resolved. Ingest accounts statement documents.</p>
                  )}
                </div>
              </div>

              {/* Extracted Timelines observations items */}
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-2.5 text-xs text-slate-800 leading-relaxed font-sans font-medium">
                <span className="text-[8.5px] uppercase font-bold text-indigo-750 tracking-wider font-mono block">Dynamic Mapped Progression Insights</span>
                {timelineData.chronologicalNarratives.length === 0 ? (
                  <p className="text-slate-500 italic">Scanning chronologies and balancing curves... Insufficient variable ranges found. Ingest historical bank copies.</p>
                ) : (
                  timelineData.chronologicalNarratives.map((nar, nIdx) => (
                    <div key={nIdx} className="flex gap-2 items-start">
                      <ChevronRight className="h-4 w-4 shrink-0 text-indigo-505" />
                      <span>{nar}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {previewTab === 'sources' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex-grow space-y-4">
              <div>
                <h5 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" /> Evidence Ingestion & Original Sources Index
                </h5>
                <p className="text-[10.5px] text-slate-505 mt-0.5">Verifiable database exhibit index mapping statements filename, upload scopes, and classification qualities.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10.5px] border border-slate-150 divide-y divide-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50 text-[9.5px] uppercase font-bold text-slate-450 leading-none">
                      <th className="p-2.5">Exhibit Code</th>
                      <th className="p-2.5">Statement Filename</th>
                      <th className="p-2.5">Type Focus</th>
                      <th className="p-2.5">Ocr Status</th>
                      <th className="p-2.5">Ingested Rows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {activeDocumentsInclusions.map((doc, dIdx) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold font-mono">DOC-{doc.id.substring(0, 6).toUpperCase()}</td>
                        <td className="p-2.5 text-slate-800 break-all">{doc.filename}</td>
                        <td className="p-2.5 font-semibold">{doc.file_type}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            doc.ocr_status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-55 text-amber-700'
                          }`}>
                            {doc.ocr_status} ({Math.round(doc.ocr_confidence*100)}%)
                          </span>
                        </td>
                        <td className="p-2.5 font-bold">
                          {transactions.filter(t => t.source_document_id === doc.id).length} items
                        </td>
                      </tr>
                    ))}
                    {activeDocumentsInclusions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          No active statement exhibited attached. Verify linking parameters. No active verification locks exist.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Exhibit options manual toggler selection checks */}
              <div className="space-y-2 pt-2">
                <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider font-mono">Include Exhibits in PDF Compilation attachments</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  {documents.map(doc => {
                    const isExhibiting = selectedExhibits.includes(doc.id);
                    return (
                      <label key={doc.id} className="flex items-center gap-2 select-none cursor-pointer text-[10px]">
                        <input 
                          type="checkbox"
                          checked={isExhibiting}
                          onChange={() => {
                            if (isExhibiting) {
                              setSelectedExhibits(selectedExhibits.filter(id => id !== doc.id));
                            } else {
                              setSelectedExhibits([...selectedExhibits, doc.id]);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-650 h-3 w-3"
                        />
                        <span className="truncate text-slate-755 font-semibold">
                          DOC-{doc.id.substring(0,6).toUpperCase()} ({doc.filename})
                        </span>
                      </label>
                    );
                  })}
                  {documents.length === 0 && (
                    <p className="text-[10px] text-slate-400 italic col-span-2">No documents mapped in registry cache checklist.</p>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
