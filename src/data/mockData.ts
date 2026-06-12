import { AccountSummary, DocumentRecord, CategoryRule, Transaction, AuditLog } from '../types';
import { detectReconciliationQueues } from '../utils/dataEngine';

export const SYSTEM_CATEGORIES = [
  'Groceries',
  'Utilities',
  'Childcare',
  'Medical',
  'Gas/Fuel',
  'Restaurants',
  'Housing',
  'Travel',
  'Education',
  'Entertainment',
  'Legal',
  'Income/Deposits',
  'Transfers',
  'Miscellaneous'
];

export const INITIAL_ACCOUNTS: AccountSummary[] = [
  {
    id: 'ACC-001',
    account_name: 'Primary Checking',
    account_suffix: '4321',
    account_type: 'checking',
    institution_name: 'Metro National Bank',
    current_balance: 14245.50,
    available_balance: 14100.00,
    statement_period: 'May 1, 2026 - May 31, 2026',
    account_status: 'Active',
    is_joint: true
  },
  {
    id: 'ACC-002',
    account_name: 'Horizon Savings',
    account_suffix: '5555',
    account_type: 'savings',
    institution_name: 'Metro National Bank',
    current_balance: 42100.00,
    available_balance: 42100.00,
    statement_period: 'May 1, 2026 - May 31, 2026',
    account_status: 'Active',
    is_joint: false
  },
  {
    id: 'ACC-003',
    account_name: 'Apex Elite Credit Card',
    account_suffix: '8888',
    account_type: 'credit_card',
    institution_name: 'Apex Bank Trust',
    current_balance: 1250.35,
    available_balance: 13749.65,
    statement_period: 'May 1, 2026 - May 28, 2026',
    account_status: 'Active',
    is_joint: true
  },
  {
    id: 'ACC-004',
    account_name: 'Household Line of Credit',
    account_suffix: '1402',
    account_type: 'loan',
    institution_name: 'Regional Credit Union',
    current_balance: 8500.00,
    available_balance: 11500.00,
    statement_period: 'April 15, 2026 - May 15, 2026',
    account_status: 'Active',
    is_joint: false
  }
];

export const INITIAL_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'DOC-101',
    filename: 'MetroChecking_May2026_Statement.pdf',
    upload_timestamp: '2026-06-01T10:14:22Z',
    file_type: 'Checking',
    ocr_status: 'Success',
    ocr_confidence: 0.96,
    account_id: 'ACC-001',
    institution_name: 'Metro National Bank',
    statement_period: '05/01/2026 - 05/31/2026',
    user_notes: 'Primary marital expense checking statement',
    processing_status: 'Completed',
    raw_text: `METRO NATIONAL BANK\nStatement Period: 05/01/2026 - 05/31/2026\nAccount Ending Part: *4321\nJane S. Doe & John C. Doe\n\n05/01  Balance Forward  $5,243.21\n05/02  Direct Deposit - State Payroll Net  +$4,100.00\n05/05  Walmart Store Super  -$324.50 (POS)\n05/08  Duke Energy Utilities Bill - ACH -$189.90\n05/12  ATM cash withdrawal  -$400.00\n05/15  Primary Care Medical Visit -$120.00\n05/20  Internal Transfer from Savings *5555  +$3,500.00\n05/22  Credit card payment ACH debit to CC *8888  -$3,500.00\n05/25  Direct Payment Gas Station S -$45.00\n05/28  Starbucks Store Coffee -$22.50\n05/31  Ending balance: $12,361.31`
  },
  {
    id: 'DOC-102',
    filename: 'SavingsLedger_May2026.xlsx',
    upload_timestamp: '2026-06-01T11:05:10Z',
    file_type: 'Savings',
    ocr_status: 'Success',
    ocr_confidence: 0.98,
    account_id: 'ACC-002',
    institution_name: 'Metro National Bank',
    statement_period: '05/01/2026 - 05/31/2026',
    user_notes: 'Individual savings folder ledger',
    processing_status: 'Completed',
    raw_text: `METRO SAVINGS -- INDIVIDUAL *5555\n05/01 Balance Forward: $42,100.00\n05/20 Internal Transfer to Checking *4321 -$3,500.00\n05/29 Applied Monthly Interest: +$8.40\n05/31 Ending Balance: $38,608.40`
  },
  {
    id: 'DOC-103',
    filename: 'Apex_Credit_May_2026.csv',
    upload_timestamp: '2026-06-01T14:32:00Z',
    file_type: 'Credit Card',
    ocr_status: 'Success',
    ocr_confidence: 0.94,
    account_id: 'ACC-003',
    institution_name: 'Apex Bank Trust',
    statement_period: '05/01/2026 - 05/28/2026',
    user_notes: 'Joint visa card statement with high retail count',
    processing_status: 'Completed',
    raw_text: `Apex Bank Trust -- Statement *8888\n05/03  WHOLE FOODS DISCRETIONARY -$124.30\n05/05  Walmart Store Grocery -$85.00\n05/08  Shell Fuel Station Gas -$65.00\n05/11  Family Fun Theme Park Ticket -$450.00\n05/13  NC YMCA Childcare monthly dues -$260.00\n05/18  Amazon Marketplace Books/Retail -$89.90\n05/20  Chick-Fil-A Dining Out -$42.15\n05/22  ACH Direct Debit Payment Recv +$3,500.00`
  },
  {
    id: 'DOC-104',
    filename: 'Scanned_Receipt_Target.jpg',
    upload_timestamp: '2026-06-02T09:15:00Z',
    file_type: 'Receipt',
    ocr_status: 'Low Confidence',
    ocr_confidence: 0.72,
    institution_name: 'Target Store #2243',
    user_notes: 'Crumpled paper receipt, OCR misaligned some line item characters',
    processing_status: 'Requires Verification',
    raw_text: `TARGET STORE #2243\n05/14/2026 18:24\nORGANIC VEGETABLES: $24.50\nKIDS DIAPERS PACK: $45.00 [Confidence 54%]\nBABY FORMULA CAN: $35.00\nTOTAL RETAL: $104.50\nPAID DEBT *4321: $104.50`
  },
  {
    id: 'DOC-105',
    filename: 'Paystub_State_Department.pdf',
    upload_timestamp: '2026-06-02T13:20:00Z',
    file_type: 'Paystub',
    ocr_status: 'Success',
    ocr_confidence: 0.97,
    institution_name: 'State Health Department',
    user_notes: 'Biweekly salary slip Jane S. Doe',
    processing_status: 'Completed',
    raw_text: `STATE HEALTH DEPT PAYSLIP\nPay Date: 05/15/2026\nJane S. Doe / Employee #89422\nRegular Gross: $6,000.00\nFederal Tax: -$820.00\nState Tax: -$320.00\nPension EE: -$300.00\nNet Paid to Metro Checking *4321: $4,320.00\nExtra routed deposit to Reserve Holdings *1402: $260.00`
  },
  // Unidentified files to simulate the unclassified workflow
  {
    id: 'DOC-201',
    filename: 'Unknown_Scanned_Img_92.png',
    upload_timestamp: '2026-06-03T16:44:00Z',
    file_type: 'Unidentified',
    ocr_status: 'Low Confidence',
    ocr_confidence: 0.45,
    institution_name: 'Landscape Maintenance Inc',
    user_notes: 'No obvious logo or account details extracted',
    processing_status: 'Requires Classification',
    raw_text: `LANDSCAPE MAINTENANCE SERVICE\nINC. #443-A\nDUSTING, OUTDOOR SOD, MOWING: $220.00\n05/18/2026\nSign: J. Doe`
  },
  {
    id: 'DOC-202',
    filename: 'Check_Deposit_Voucher_Void.pdf',
    upload_timestamp: '2026-06-04T11:12:00Z',
    file_type: 'Unidentified',
    ocr_status: 'Low Confidence',
    ocr_confidence: 0.38,
    institution_name: 'Void Account Deposit',
    user_notes: 'Fuzzy image check front',
    processing_status: 'Requires Classification',
    raw_text: `VOID -- REGISTER RECEIPT\nCHECK PAYMENT ORDER: $1,200.00\nPAY TO THE ORDER OF: John C. Doe\nMEMO: CONSULTING WORK FEES`
  }
];

export const INITIAL_RULES: CategoryRule[] = [
  { id: 'R-001', keyword: 'WALMART', assigned_category: 'Groceries', created_at: '2026-06-01T00:00:00Z', hits_count: 2 },
  { id: 'R-002', keyword: 'DUKE ENERGY', assigned_category: 'Utilities', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-003', keyword: 'NC YMCA', assigned_category: 'Childcare', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-004', keyword: 'MORTGAGE', assigned_category: 'Housing', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-005', keyword: 'SHELL', assigned_category: 'Gas/Fuel', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-006', keyword: 'WHOLE FOODS', assigned_category: 'Groceries', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-007', keyword: 'PAYROLL', assigned_category: 'Income/Deposits', created_at: '2026-06-01T00:00:00Z', hits_count: 1 },
  { id: 'R-008', keyword: 'CHICK-FIL-A', assigned_category: 'Restaurants', created_at: '2026-06-01T00:00:00Z', hits_count: 1 }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Metro Checking Account *4321 Entries
  {
    transaction_id: 'TX-1001',
    transaction_date: '2026-05-02',
    exact_timestamp: '2026-05-02T08:30:00Z',
    raw_description: 'STATE HEALTH DEPT DIRECT DIG PAYROLL',
    clean_vendor_name: 'State Health Department',
    amount: 4320.00,
    transaction_type: 'credit',
    processing_method: 'ACH',
    card_or_account_suffix: '4321',
    category: 'Income/Deposits',
    is_pending: false,
    running_balance: 9563.21,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.98
  },
  {
    transaction_id: 'TX-1002',
    transaction_date: '2026-05-05',
    exact_timestamp: '2026-05-05T14:32:00Z',
    raw_description: 'WALMART STORE #3421 RETAIL OUTLET',
    clean_vendor_name: 'Walmart Store #3421',
    amount: 324.50,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '4321',
    category: 'Groceries',
    is_pending: false,
    running_balance: 9238.71,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.95,
    splits: [
      { category: 'Groceries', amount: 142.50, percentage: 44 },
      { category: 'Childcare', amount: 82.00, percentage: 25 },
      { category: 'Entertainment', amount: 100.00, percentage: 31 }
    ]
  },
  {
    transaction_id: 'TX-1003',
    transaction_date: '2026-05-08',
    exact_timestamp: '2026-05-08T06:15:00Z',
    raw_description: 'ACH DEB DUKE ENERGY POWER BILL',
    clean_vendor_name: 'Duke Energy',
    amount: 189.90,
    transaction_type: 'debit',
    processing_method: 'ACH',
    card_or_account_suffix: '4321',
    category: 'Utilities',
    is_pending: false,
    running_balance: 9048.81,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.97
  },
  {
    transaction_id: 'TX-1004',
    transaction_date: '2026-05-12',
    exact_timestamp: '2026-05-12T11:24:00Z',
    raw_description: 'ATM CASH WITHDRAWAL 121 ELM ST',
    clean_vendor_name: 'ATM Cash Withdrawal',
    amount: 400.00,
    transaction_type: 'debit',
    processing_method: 'ATM',
    card_or_account_suffix: '4321',
    category: 'Miscellaneous',
    is_pending: false,
    running_balance: 8648.81,
    notes: 'Large cash withdraw during mediation week. Requires receipts.',
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.99
  },
  {
    transaction_id: 'TX-1005',
    transaction_date: '2026-05-15',
    exact_timestamp: '2026-05-15T09:44:00Z',
    raw_description: 'PRIMARY CARE MEDICAL VISIT PARTNER',
    clean_vendor_name: 'Primary Care Medical',
    amount: 120.00,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '4321',
    category: 'Medical',
    is_pending: false,
    running_balance: 8528.81,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.89
  },
  {
    transaction_id: 'TX-1006',
    transaction_date: '2026-05-20',
    exact_timestamp: '2026-05-20T10:02:00Z',
    raw_description: 'INTERNAL SAVINGS TRANSFER FRM SAV *5555',
    clean_vendor_name: 'Transfer from Savings *5555',
    amount: 3500.00,
    transaction_type: 'credit',
    processing_method: 'Wire',
    card_or_account_suffix: '4321',
    category: 'Transfers',
    is_pending: false,
    running_balance: 12028.81,
    notes: 'Identified internal marital transfer - excluded from net costs',
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.94
  },
  {
    transaction_id: 'TX-1007',
    transaction_date: '2026-05-22',
    exact_timestamp: '2026-05-22T17:05:00Z',
    raw_description: 'ACH DIRECT DEBIT TO APEX VISA *8888',
    clean_vendor_name: 'Apex Credit Payment',
    amount: 3500.00,
    transaction_type: 'debit',
    processing_method: 'ACH',
    card_or_account_suffix: '4321',
    category: 'Transfers',
    is_pending: false,
    running_balance: 8528.81,
    notes: 'Debt paydown. Internal transfer linkage mapped.',
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.98
  },
  {
    transaction_id: 'TX-1008',
    transaction_date: '2026-05-25',
    exact_timestamp: '2026-05-25T07:22:00Z',
    raw_description: 'DIRECT PAY GAS SHELL S RALEIGH',
    clean_vendor_name: 'Shell Fuel Station',
    amount: 45.00,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '4321',
    category: 'Gas/Fuel',
    is_pending: false,
    running_balance: 8483.81,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.91
  },
  {
    transaction_id: 'TX-1009',
    transaction_date: '2026-05-28',
    exact_timestamp: '2026-05-28T08:14:00Z',
    raw_description: 'STARBUCKS STORE COFFEE DURHAM NC',
    clean_vendor_name: 'Starbucks Coffee',
    amount: 22.50,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '4321',
    category: 'Restaurants',
    is_pending: false,
    running_balance: 8461.31,
    source_document_id: 'DOC-101',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.96
  },

  // Savings Account *5555 Entries
  {
    transaction_id: 'TX-2001',
    transaction_date: '2026-05-20',
    exact_timestamp: '2026-05-20T10:02:00Z',
    raw_description: 'INTERNAL BILL PAYMENT TRANSFER TO CHKG *4321',
    clean_vendor_name: 'Transfer to Checking *4321',
    amount: 3500.00,
    transaction_type: 'debit',
    processing_method: 'Wire',
    card_or_account_suffix: '5555',
    category: 'Transfers',
    is_pending: false,
    running_balance: 38600.00,
    source_document_id: 'DOC-102',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.99
  },
  {
    transaction_id: 'TX-2002',
    transaction_date: '2026-05-29',
    exact_timestamp: '2026-05-29T23:59:00Z',
    raw_description: 'APPLIED INTEREST PAYOUT MONTHLY',
    clean_vendor_name: 'Interest Yield Credit',
    amount: 8.40,
    transaction_type: 'credit',
    processing_method: 'Other',
    card_or_account_suffix: '5555',
    category: 'Income/Deposits',
    is_pending: false,
    running_balance: 38608.40,
    source_document_id: 'DOC-102',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.99
  },

  // Apex Visa Credit Card *8888 Entries
  {
    transaction_id: 'TX-3001',
    transaction_date: '2026-05-03',
    exact_timestamp: '2026-05-03T16:11:00Z',
    raw_description: 'WHOLE FOODS DISCRETIONARY STORE DURHAM',
    clean_vendor_name: 'Whole Foods Market',
    amount: 124.30,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Groceries',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.94
  },
  {
    transaction_id: 'TX-3002',
    transaction_date: '2026-05-05',
    exact_timestamp: '2026-05-05T14:48:00Z',
    raw_description: 'WALMART STORE GROCERY BILL',
    clean_vendor_name: 'Walmart Store Grocery',
    amount: 85.00,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Groceries',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.92
  },
  {
    transaction_id: 'TX-3003',
    transaction_date: '2026-05-08',
    exact_timestamp: '2026-05-08T09:12:00Z',
    raw_description: 'SHELL FUEL STATION RALEIGH NC',
    clean_vendor_name: 'Shell Fuel Station',
    amount: 65.00,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Gas/Fuel',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.96
  },
  {
    transaction_id: 'TX-3004',
    transaction_date: '2026-05-11',
    exact_timestamp: '2026-05-11T13:40:00Z',
    raw_description: 'FAMILY FUN THEME PARK APEX NC',
    clean_vendor_name: 'Family Fun Theme Park',
    amount: 450.00,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Entertainment',
    is_pending: false,
    notes: 'Unilateral travel expense during marriage dissolution process.',
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.93
  },
  {
    transaction_id: 'TX-3005',
    transaction_date: '2026-05-13',
    exact_timestamp: '2026-05-13T10:05:00Z',
    raw_description: 'NC YMCA DURHAM CHILDCARE MONTHLY',
    clean_vendor_name: 'NC YMCA Childcare',
    amount: 260.00,
    transaction_type: 'debit',
    processing_method: 'ACH',
    card_or_account_suffix: '8888',
    category: 'Childcare',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.95
  },
  {
    transaction_id: 'TX-3006',
    transaction_date: '2026-05-18',
    exact_timestamp: '2026-05-18T16:21:00Z',
    raw_description: 'AMAZON MARKETPLACE BOOKS RETAIL',
    clean_vendor_name: 'Amazon Marketplace',
    amount: 89.90,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Education',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.92
  },
  {
    transaction_id: 'TX-3007',
    transaction_date: '2026-05-20',
    exact_timestamp: '2026-05-20T12:30:00Z',
    raw_description: 'CHICK-FIL-A DURHAM DRIVE OUT',
    clean_vendor_name: 'Chick-Fil-A Drive Out',
    amount: 42.15,
    transaction_type: 'debit',
    processing_method: 'POS',
    card_or_account_suffix: '8888',
    category: 'Restaurants',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.97
  },
  {
    transaction_id: 'TX-3008',
    transaction_date: '2026-05-22',
    exact_timestamp: '2026-05-22T17:05:00Z',
    raw_description: 'ACH DIRECT DEBIT PMT RECEIVABLE APEX',
    clean_vendor_name: 'Transfer from Primary Checking *4321',
    amount: 3500.00,
    transaction_type: 'credit',
    processing_method: 'ACH',
    card_or_account_suffix: '8888',
    category: 'Transfers',
    is_pending: false,
    source_document_id: 'DOC-103',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.95
  },

  // Line of Credit *1402 Entries (Household debt)
  {
    transaction_id: 'TX-4001',
    transaction_date: '2026-04-20',
    exact_timestamp: '2026-04-20T09:00:00Z',
    raw_description: 'HOUSING ROOFING GENERAL CONTRACTOR REPAIR',
    clean_vendor_name: 'General Contractor House Repair',
    amount: 8500.00,
    transaction_type: 'debit',
    processing_method: 'Wire',
    card_or_account_suffix: '1402',
    category: 'Housing',
    is_pending: false,
    running_balance: 8500.00,
    source_document_id: 'DOC-105',
    classification_ruleset_version: 'NC-family-v1',
    confidence_score: 0.96
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AL-001',
    timestamp: '2026-06-05T09:12:00Z',
    action: 'SYSTEM_BOOTUP',
    details: 'NAFA LEDGER application initialization. Preset NC-family-v1 ruleset injected securely.',
    level: 'info',
    operator: 'Application Services System'
  },
  {
    id: 'AL-002',
    timestamp: '2026-06-05T09:15:20Z',
    action: 'SEEDING_ACCOUNTS',
    details: 'Mapped Metro National bank accounts and regional line of credit references.',
    level: 'info',
    operator: 'Application Services System'
  },
  {
    id: 'AL-003',
    timestamp: '2026-06-05T10:14:22Z',
    action: 'INGEST_DOCUMENT',
    details: 'Ingested document "MetroChecking_May2026_Statement.pdf". Verified 11 extracted rows.',
    level: 'info',
    operator: 'System Ingest Service'
  },
  {
    id: 'AL-004',
    timestamp: '2026-06-05T10:15:10Z',
    action: 'TRANSFER_RECONCILED',
    details: 'Link verified: Horizontal Savings Savings transfer of -$3,500 matched directly to Metro Checking deposit of +$3,500.',
    level: 'info',
    operator: 'Transfer Matching Engine'
  },
  {
    id: 'AL-005',
    timestamp: '2026-06-05T11:42:15Z',
    action: 'LOW_CONFIDENCE_WARNING',
    details: 'OCR warning alert triggered on "Scanned_Receipt_Target.jpg": Average optical read score is 72%. Flagged diaper row for manual verification.',
    level: 'warning',
    operator: 'System OCR Processor'
  }
];

export const MOCK_ACCOUNTS = INITIAL_ACCOUNTS;
export const MOCK_DOCUMENTS = INITIAL_DOCUMENTS;
export const MOCK_TRANSACTIONS = INITIAL_TRANSACTIONS;
export const MOCK_RULES = INITIAL_RULES;
export const MOCK_AUDIT_LOGS = INITIAL_AUDIT_LOGS;
export const MOCK_RECON_ITEMS = detectReconciliationQueues(INITIAL_TRANSACTIONS, INITIAL_DOCUMENTS);
