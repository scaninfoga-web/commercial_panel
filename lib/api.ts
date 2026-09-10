'use client';

import axios, { type AxiosRequestConfig, type Method } from 'axios';
import { getCookie } from 'cookies-next';
import { getClientInfo } from '@/lib/header';

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.scaninfoga.com';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Drops the session and sends the browser to the sign-in page.
 *
 * The redux store is pulled in lazily: `walletSlice` imports this module, so a
 * top-level import would close a cycle at module-init time. By the time a 401
 * can arrive both modules are fully evaluated.
 *
 * `logout` clears the `accessToken`/`user`/`expiresAt` cookies, so the hard
 * navigation (rather than a router push) re-runs middleware with no token and
 * lands on `/auth` with a clean client state. The flag keeps a burst of
 * parallel 401s from firing several redirects.
 */
let loggingOut = false;

const forceLogout = async () => {
  if (typeof window === 'undefined' || loggingOut) return;
  loggingOut = true;

  try {
    const [{ store, persistor }, { logout }] = await Promise.all([
      import('@/redux/store'),
      import('@/redux/userSlice'),
    ]);
    store.dispatch(logout());
    await persistor.flush();
  } catch {
    // Even if the store can't be reached, the redirect below still gets the
    // user out of the authenticated area.
  }

  window.location.href = '/auth';
};

/**
 * A 401 means the token is gone, expired or rejected — sign the user out.
 *
 * Auth routes are exempt: a wrong password on sign-in also answers 401, and
 * that has to surface as a form error instead of a redirect.
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error?.config?.url ?? '';
    if (error?.response?.status === 401 && !url.includes('/auth')) {
      void forceLogout();
    }
    return Promise.reject(error);
  },
);

/**
 * Sends a request and returns the raw response body.
 *
 * Encryption support has been removed — the backend is expected to reply in
 * plain JSON for every route now, so no envelope decoding happens here.
 */
const sendRequest = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await axiosInstance(config);
  return response.data as T;
};

export const getAuthToken = (): string | null => {
  const raw = getCookie('accessToken');
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    return typeof raw === 'string' ? raw : null;
  }
};

export const apiCall = async <T = any>(
  method: Method,
  endpoint: string,
  payload: any = null,
  additionalConfig: AxiosRequestConfig = {},
): Promise<T> => {
  const token = getAuthToken();
  const clientInfo = await getClientInfo();

  const headers: Record<string, any> = {
    ...additionalConfig.headers,
    clientInfo: JSON.stringify(clientInfo),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config: AxiosRequestConfig = {
    baseURL: getBaseUrl(),
    method,
    url: endpoint,
    ...additionalConfig,
    headers,
  };

  if (
    payload !== null &&
    ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase())
  ) {
    let body_to_send = {};
    if (!endpoint.includes('/auth')) {
      body_to_send = {
        ...payload,
        purpose: 'verification',
        consent:
          'I confirm that I have obtained user consent to access and process data for verification and compliance purposes.',
      };
    } else {
      body_to_send = payload;
    }
    config.data = body_to_send;
  }

  if (payload !== null && method.toLowerCase() === 'get') {
    config.params = payload;
  }

  return sendRequest<T>(config);
};

export const get = <T = any>(
  endpoint: string,
  params = null,
  config: AxiosRequestConfig = {},
  timeoutSeconds?: number,
) =>
  apiCall<T>('get', endpoint, params, {
    ...config,
    ...(timeoutSeconds !== undefined ? { timeout: timeoutSeconds * 1000 } : {}),
  });

export const post = <T = any>(
  endpoint: string,
  data = {},
  config: AxiosRequestConfig = {},
  timeoutSeconds?: number,
) =>
  apiCall<T>('post', endpoint, data, {
    ...config,
    ...(timeoutSeconds !== undefined ? { timeout: timeoutSeconds * 1000 } : {}),
  });

export const put = <T = any>(endpoint: string, data = null, config = {}) =>
  apiCall<T>('put', endpoint, data, config);

export const patch = <T = any>(endpoint: string, data = null, config = {}) =>
  apiCall<T>('patch', endpoint, data, config);

export const del = <T = any>(endpoint: string, data = {}, config = {}) =>
  apiCall<T>('delete', endpoint, data, config);




export default axiosInstance;