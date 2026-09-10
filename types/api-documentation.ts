export interface ApiDocumentation {
  endpoint: string;
  title: string;
  description?: string;
  category?: string;
  price?: string | number;
  request?: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>; 
  };
  response?: {
    success?: {
      status_code?: number;
      description?: string;
      example?: Record<string, unknown>;
    };
    error?: {
      status_code?: number;
      description?: string;
      example?: Record<string, unknown>;
    };
    [key: string]: any; 
  };
  errors?: Array<{ code: number; message: string }>;
  notes?: string;
  [key: string]: any; 
}