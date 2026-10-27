export interface IASReport {
  request: {
    date_range: string;
    format: "XLSX";
    send_email: boolean;
  };

  response: {
    responseStatus: {
      status: boolean;
      statusCode: number;
      statusMessage: string;
      message: string;
    };
    responseData: {
      report_id: string;
      format: "XLSX";
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
        activity: {
          total: number;
          success: number;
          failed: number;
          success_rate: number;
          total_spent: number;
          avg_duration: number;
          unique_endpoints: number;
          endpoint_usage: {
            endpoint: string;
            hits: number;
            success: number;
            spent: number;
            share: number;
          }[];
          status_codes: {
            status_code: number;
            label: string;
            count: number;
            share: number;
          }[];
        };
        transaction: {
          total: number;
          credit: number;
          debit: number;
          net: number;
          completed: number;
          pending: number;
          failed: number;
          reversed: number;
          unique_apis: number;
          api_usage: {
            api_name: string;
            endpoint: string;
            transactions: number;
            completed: number;
            debit: number;
            credit: number;
            share: number;
            debit_share: number;
          }[];
          opening_balance: number;
          closing_balance: number;
        };
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
        activity: { xlsx_url?: string; pdf_url?: string };
        transaction: { xlsx_url?: string; pdf_url?: string };
      };
      file_details: {
        kind: "ACTIVITY" | "TRANSACTION";
        file_type: "XLSX" | "PDF";
        label: string;
        file_name: string;
        size_bytes: number;
        url: string;
      }[];
      link_expires_in_hours: number;
      link_expires_at: string;
      email_queued: boolean;
      failed_files: string[];
    };
  };

  conflict: {
    responseStatus: {
      status: boolean;
      statusCode: number;
      statusMessage: string;
      message: string;
    };
    responseData: {
      report_id: string;
    };
  };

  status: {
    request: {
      report_id: string;
    };
    response: {
      responseStatus: {
        status: boolean;
        statusCode: number;
        statusMessage: string;
        message: string;
      };
      responseData: Partial<IASReport["response"]["responseData"]> & {
        report_id: string;
        status?: string;
        message?: string;
        progress?: number;
      };
    };
  };
}