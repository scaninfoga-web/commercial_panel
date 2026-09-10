// Domain types for the transactions feature.
// Everything here is transaction-specific — nothing needs to live in a
// shared lib/types.ts. If you later add a generic `ApiResponse<T>` wrapper
// type there (as used elsewhere in the app), these types compose with it
// as `ApiResponse<TransactionsResponseData>` without any changes needed here.

export type TransactionType = "DEBIT" | "CREDIT";
export type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED" | "REVERSED";
export type TransactionKeyType = "DEVELOPMENT" | "PRODUCTION";

export interface TransactionStatusBreakdown {
  total_completed: number;
  total_pending: number;
  total_failed: number;
  total_reversed: number;
}

export interface TransactionOverviewStats {
  total_transactions: number;
  total_credit: number;
  total_debit: number;
  total_success: number;
  status_breakdown: TransactionStatusBreakdown;
}

// A monthly bucket is just an overview section with a month + label attached,
// so it extends the base shape instead of repeating every field.
export interface MonthlyTransactionStat extends TransactionOverviewStats {
  month: string; // e.g. "2026-04"
  label: string; // e.g. "Apr 2026"
}

export interface Transaction {
  id: string;
  txn_id: string;
  key_id: string | null;
  key_type: TransactionKeyType | null;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balance_after: number;
  endpoint: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TransactionsResponseData {
  overview_stats: {
    today: TransactionOverviewStats;
    lifetime: TransactionOverviewStats;
    monthly: MonthlyTransactionStat[];
  };
  transactions: Transaction[];
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface TransactionFilters {
  limit?: number;
  cursor?: string;
  key_type?: TransactionKeyType;
  type?: TransactionType;
  status?: TransactionStatus;
  endpoint?: string;
  txn_id?: string;
}