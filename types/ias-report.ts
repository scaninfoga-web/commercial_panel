export type ReportFormat = "BOTH" | "PDF" | "XLSX";
export type ReportFileType = "XLSX" | "PDF";
export type ReportKind = "ACTIVITY" | "TRANSACTION";

export interface EndpointUsage {
  endpoint: string;
  hits: number;
  success: number;
  spent: number;
  share: number;
}

export interface ApiUsage {
  api_name: string;
  endpoint: string;
  transactions: number;
  completed: number;
  debit: number;
  credit: number;
  share: number;
  debit_share: number;
}

export interface ActivityOverview {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
  total_spent: number;
  avg_duration: number;
  unique_endpoints: number;
  endpoint_usage: EndpointUsage[];
}

export interface TransactionOverview {
  total: number;
  credit: number;
  debit: number;
  net: number;
  completed: number;
  pending: number;
  failed: number;
  reversed: number;
  unique_apis: number;
  api_usage: ApiUsage[];
}

export interface ReportFile {
  kind: ReportKind;
  file_type: ReportFileType;
  label: string;
  file_name: string;
  size_bytes: number;
  url: string;
}

export interface IASReportResponseData {
  report_id: string;
  format: ReportFormat;
  generated_at: string;
  generated_at_label: string;
  period: {
    from: string;
    to: string;
    from_label: string;
    to_label: string;
    label: string;
    days: number;
  };
  overview_stats: {
    activity: ActivityOverview;
    transaction: TransactionOverview;
  };
  records: {
    activities_total: number;
    activities_in_report: number;
    activities_truncated: boolean;
    transactions_total: number;
    transactions_in_report: number;
    transactions_truncated: boolean;
  };
  files: {
    activity: { xlsx_url: string; pdf_url: string };
    transaction: { xlsx_url: string; pdf_url: string };
  };
  file_details: ReportFile[];
  link_expires_in_hours: number;
  link_expires_at: string;
  email_queued: boolean;
  failed_files: string[];
}

export interface IASReportFilters {
  date_range: string;
  format: ReportFormat;
  send_email: boolean;
}