'use client';

import axios, { AxiosError } from 'axios';
import { getAuthToken } from '@/lib/api';
import { getClientInfo } from '@/lib/header';

/**
 * Handoff to the face-match + liveness worker (`workers/face_liveness_service`).
 *
 * The worker is NOT the main backend: it speaks plain JSON with no ECDH
 * envelope and no `purpose` / `consent` body, so it cannot go through
 * `lib/api`. It is called browser-side on purpose — its CORS allowlist exists
 * for exactly this origin — and it takes the user's bearer token plus the
 * `clientInfo` header, because the video-KYC callback it fires later mounts
 * below the backend's header and auth middleware and needs both.
 *
 * Nothing sensitive travels in the redirect: the worker keeps the token, the
 * clientInfo header and the Aadhaar photo URL server-side and hands back only
 * an opaque token, which is all that appears in the URL the user is sent to.
 */

/**
 * Query params the worker appends to `return_url` on a recorded PASS — see
 * `_build_return_url` in `face_liveness_service/app/main.py`. The caller's own
 * query is preserved, so these are added alongside whatever we sent.
 */
export const VIDEO_KYC_RETURN_PARAM = 'kyc';
export const VIDEO_KYC_RETURN_VALUE = 'success';
/** The captured photo the worker uploaded and recorded on the account. */
export const VIDEO_KYC_PROFILE_IMAGE_PARAM = 'profile_image_url';
export const VIDEO_KYC_SESSION_ID_PARAM = 'session_id';

/** The worker only redirects back on a PASS the main backend has recorded. */
const SESSION_TIMEOUT_MS = 20000;

export interface VideoKycSession {
  kyc_token: string;
  /** Where to send the browser — already carries `?k=<opaque token>`. */
  verify_url: string;
  expires_at: number;
}

export interface CreateVideoKycSessionParams {
  /** UIDAI photo pulled during Aadhaar KYC — the face-match reference. */
  aadhaarImageUrl: string;
  profileImageUrl?: string | null;
  /** Absolute URL the worker sends the user back to once KYC is recorded. */
  returnUrl: string;
}

const getVideoKycBaseUrl = (): string =>
  (process.env.NEXT_PUBLIC_VIDEO_KYC_URL || '').replace(/\/+$/, '');

/** FastAPI reports failures as `{ "detail": "…" }`, not the backend envelope. */
export function extractVideoKycError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail) return detail;
    if (err.code === 'ECONNABORTED' || !err.response) {
      return 'Could not reach the video KYC service. Please try again.';
    }
    return fallback;
  }
  // The pre-flight failures raised below (no config, no token) already carry a
  // message written for the user.
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Where the worker sends the user back to. Absolute on purpose — the worker
 * rejects anything else, and checks the origin against its allowlist. The
 * outcome params are added by the worker, not here.
 */
export function videoKycReturnUrl(pathname: string): string {
  return new URL(pathname, window.location.origin).toString();
}

export interface VideoKycReturn {
  /** True when this page load is the redirect back from a recorded PASS. */
  done: boolean;
  /** The verified photo the worker recorded on the account, if it sent one. */
  profileImage: string | null;
  /** The worker's verification session — useful in support/audit trails. */
  sessionId: string | null;
}

const NO_RETURN: VideoKycReturn = {
  done: false,
  profileImage: null,
  sessionId: null,
};

/**
 * Reads the return flags off the current URL. Pure — safe to call during
 * render, which the gate needs so it never renders a stale pending state for
 * one frame. Stripping the flags is a separate, effect-only step below.
 */
export function readVideoKycReturn(): VideoKycReturn {
  if (typeof window === 'undefined') return NO_RETURN;
  const params = new URLSearchParams(window.location.search);
  if (params.get(VIDEO_KYC_RETURN_PARAM) !== VIDEO_KYC_RETURN_VALUE) {
    return NO_RETURN;
  }
  return {
    done: true,
    profileImage: params.get(VIDEO_KYC_PROFILE_IMAGE_PARAM) || null,
    sessionId: params.get(VIDEO_KYC_SESSION_ID_PARAM) || null,
  };
}

/**
 * Strips the return flags from the URL so a reload cannot replay the
 * completion. Effect-only: `history.replaceState` is patched by the App Router
 * and updates router state, so calling it during render throws
 * "Cannot update a component (Router) while rendering a different component".
 */
export function clearVideoKycReturn(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(VIDEO_KYC_RETURN_PARAM)) return;
  // Only the worker's params go — the page's own query (`?tab=…`) survives.
  params.delete(VIDEO_KYC_RETURN_PARAM);
  params.delete(VIDEO_KYC_PROFILE_IMAGE_PARAM);
  params.delete(VIDEO_KYC_SESSION_ID_PARAM);
  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
  );
}

export async function createVideoKycSession({
  aadhaarImageUrl,
  profileImageUrl,
  returnUrl,
}: CreateVideoKycSessionParams): Promise<VideoKycSession> {
  const baseUrl = getVideoKycBaseUrl();
  if (!baseUrl) {
    throw new Error('Video KYC is not configured. Please contact support.');
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const clientInfo = await getClientInfo();

  const { data } = await axios.post<VideoKycSession>(
    `${baseUrl}/api/v1/kyc/session`,
    {
      aadhaar_image_url: aadhaarImageUrl,
      profile_image_url: profileImageUrl || '',
      return_url: returnUrl,
    },
    {
      timeout: SESSION_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        clientInfo: JSON.stringify(clientInfo),
      },
    },
  );

  if (!data?.verify_url) {
    throw new Error('Video KYC service did not return a verification link.');
  }
  return data;
}
