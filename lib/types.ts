export interface ApiResponse<T> {
  responseStatus?: {
    status?: boolean;
    statusCode?: number;
    message?: string;
  };
  responseData?: T;
  data?: T;
}

export enum TxnActionType {
  GET = 'GET',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export interface PendingTopupListResponseData {
  total_pending?: number;
  total?: number;
  items?: unknown[];
}

export type CommercialApiKeyEnvironment = "DEVELOPMENT" | "PRODUCTION";
export type CommercialApiKeyStatus = "ACTIVE" | "INACTIVE" | "REVOKED";
export type CommercialApiKeyAction = "activate" | "deactivate";

export interface CommercialApiKey {
  id: string;
  type: CommercialApiKeyEnvironment;
  key?: string;
  status: CommercialApiKeyStatus;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

// ─── Activities Types (Add these to your lib/type.ts) ───────────────────────

export interface ActivityHeaders {
  ip: string | null;
  public_ip: string | null;
  isp: string | null;
  asn: string | null;
  city: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  device: string | null;
  device_type: string | null;
  platform: string | null;
  browser: string | null;
  language: string | null;
  screen_size: string | null;
  cpu_cores: string | null;
  memory: string | null;
  gpu_renderer: string | null;
  battery_level: string | null;
  is_charging: boolean | null;
  cookies_enabled: boolean | null;
  javascript_enabled: boolean | null;
  touch_support: boolean | null;
  possible_iot: boolean | null;
  cameras: string | null;
  microphones: string | null;
}

export interface Activity {
  txn_id: string;
  page: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  duration: number;
  before_balance: number;
  after_balance: number;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  timestamp: string;
  headers: ActivityHeaders;
}

export interface ActivityOverviewStats {
  total_activities: number;
  total_spent: number;
  total_success: number;
}

export interface ActivityOverview {
  today: ActivityOverviewStats;
  lifetime: ActivityOverviewStats;
}

export interface ActivitiesResponseData {
  overview: ActivityOverview;
  activities: Activity[];
  limit: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface ActivityFilters {
  limit?: number;
  cursor?: string;
  status_code?: number;
  method?: string;
  endpoint?: string;
  page?: string;
  txn_id?: string;
}
