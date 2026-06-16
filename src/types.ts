/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface AccountSummary {
  id: string;
  account_name: string;
  account_suffix: string;
  account_type: 'checking' | 'savings' | 'credit_card' | 'loan' | 'mortgage' | 'investment';
  institution_name: string;
  current_balance: number;
  available_balance: number;
  statement_period: string;
  account_status: 'Active' | 'Closed' | 'Under Review';
  is_joint?: boolean;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  upload_timestamp: string;
  file_type: 'Checking' | 'Savings' | 'Credit Card' | 'Loan' | 'Mortgage' | 'Paystub' | 'Receipt' | 'Tax' | 'Legal' | 'Unidentified';
  ocr_status: 'Pending' | 'Success' | 'Low Confidence' | 'Failed';
  ocr_confidence: number; // 0.0 - 1.0
  account_id?: string;
  institution_name: string;
  statement_period?: string;
  user_notes?: string;
  processing_status: 'Completed' | 'Requires Classification' | 'Requires Verification' | 'Processing';
  raw_text?: string;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  assigned_category: string;
  created_at: string;
  hits_count: number;
}

export interface TransactionSplit {
  category: string;
  amount: number;
  percentage: number;
}

export interface Transaction {
  transaction_id: string;
  transaction_date: string;
  exact_timestamp?: string;
  raw_description: string;
  clean_vendor_name: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  processing_method: 'ACH' | 'POS' | 'ATM' | 'Wire' | 'Other';
  card_or_account_suffix: string;
  category: string;
  is_pending: boolean;
  running_balance?: number;
  notes?: string;
  source_document_id?: string;
  confidence_score?: number; // OCR Optical quality confidence
  classification_ruleset_version?: string; // e.g. "neutral-v1" or "NC-family-v1"
  splits?: TransactionSplit[];
  manual_override?: boolean;
  original_category?: string;
  override_reason?: string;
  last_updated?: string;
  duplicate_status?: 'possible_duplicate' | 'confirmed_duplicate' | 'not_duplicate';
  transfer_status?: 'possible_transfer' | 'confirmed_transfer' | 'not_transfer';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  level: 'info' | 'warning' | 'critical';
  operator: string;
  account_id?: string;
  previous_entry_hash?: string;
  current_entry_hash?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggested_actions?: string[];
  visual_data?: {
    type: 'spend_chart' | 'recurring_summary' | 'income_debt_overlay' | 'category_totals';
    chartData?: any[];
    tableData?: any[];
  };
  matched_transactions?: Transaction[];
  calculated_total?: number;
  sources?: string[];
  query_type?: string;
}


export interface WorkspaceProfile {
  userDisplayName: string;
  workspaceName: string;
  caseOrProjectName?: string;
  jurisdiction: string;
  createdAt: string;
  lastOpenedAt: string;
  appVersion: string;
}
