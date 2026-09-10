import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { deleteCookie, getCookie, setCookie } from 'cookies-next';

const accessToken = getCookie('accessToken');
const user = getCookie('user');
const expiresAt = getCookie('expiresAt');

export type Gender = 'MALE' | 'FEMALE';

export interface User {
  name: string;
  email: string;
  mobile_number: string;
  gender: Gender | null;
  is_aadhaar_kyc: boolean;
  /** Face-match + liveness check. Runs after Aadhaar KYC, never before. */
  is_video_kyc: boolean;
  tier:
    | 'ADMIN'
    | 'NORMAL'
    | 'COMMERCIAL'
    | 'COOPERATIVE'
    | 'COOPERATIVE_MEMBER';
  /** Uploaded avatar. Falls back to `aadhaar_image` when absent. */
  profile_image: string | null;
  /** UIDAI photo pulled during Aadhaar KYC. */
  aadhaar_image: string | null;
  date_of_birth: string | null;
  /** Mobile number seeded against the Aadhaar record. */
  aadhaar_mobile_number: string | null;
}

interface UserState {
  token: string | null;
  user: User | null;
  /** ISO timestamp at which `token` stops being accepted by the backend. */
  expiresAt: string | null;
}

/**
 * Session cookies expire 5 minutes before the backend's `expires_at`, so the
 * client is always logged out first and never races a token the API has
 * already stopped accepting.
 */
export const EXPIRY_SAFETY_MARGIN_SECONDS = 5 * 60;

/**
 * Cookie options derived purely from the backend's `expires_at`. Without a
 * usable expiry the cookies fall back to session scope (cleared when the
 * browser closes) rather than an invented lifetime.
 */
const cookieOptions = (expiry?: string | null) => {
  if (!expiry) return { path: '/' };
  const remaining = Math.floor(
    (new Date(expiry).getTime() - Date.now()) / 1000,
  );
  if (!Number.isFinite(remaining)) return { path: '/' };
  return {
    path: '/',
    maxAge: Math.max(remaining - EXPIRY_SAFETY_MARGIN_SECONDS, 0),
  };
};

const parseCookie = <T>(raw: unknown): T | null => {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const initialState: UserState = {
  token: parseCookie<string>(accessToken),
  user: parseCookie<User>(user),
  expiresAt: parseCookie<string>(expiresAt),
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<
        Omit<UserState, 'expiresAt'> & { expiresAt?: string | null }
      >,
    ) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.expiresAt = action.payload.expiresAt ?? null;

      const options = cookieOptions(state.expiresAt);

      setCookie(
        'accessToken',
        JSON.stringify(action.payload.token || null),
        options,
      );
      setCookie('user', JSON.stringify(action.payload.user || null), options);
      setCookie('expiresAt', JSON.stringify(state.expiresAt), options);
    },

    /**
     * Flip the KYC flag locally once Aadhaar verification succeeds, and adopt
     * the UIDAI photo that came back with it. `aadhaarImage` is only applied
     * when present — a KYC response without a photo must not wipe the one
     * already on the profile.
     */
    setAadhaarKycVerified: (
      state,
      action: PayloadAction<{
        verified: boolean;
        aadhaarImage?: string | null;
      }>,
    ) => {
      if (!state.user) return;
      const { verified, aadhaarImage } = action.payload;
      state.user = {
        ...state.user,
        is_aadhaar_kyc: verified,
        aadhaar_image: aadhaarImage || state.user.aadhaar_image,
      };
      setCookie(
        'user',
        JSON.stringify(state.user),
        cookieOptions(state.expiresAt),
      );
    },

    /**
     * Flip the video-KYC flag locally once the liveness service reports a
     * recorded PASS, and adopt the frame it captured as the profile photo —
     * the backend has already stored the same URL against the account.
     *
     * The backend is the authority; this only unlocks the UI and refreshes the
     * avatar on the way back from the redirect, without waiting for the next
     * sign-in. `profileImage` is applied only when present, so a redirect that
     * carries no photo must not wipe the one already on the profile.
     */
    setVideoKycVerified: (
      state,
      action: PayloadAction<{
        verified: boolean;
        profileImage?: string | null;
      }>,
    ) => {
      if (!state.user) return;
      const { verified, profileImage } = action.payload;
      state.user = {
        ...state.user,
        is_video_kyc: verified,
        profile_image: profileImage || state.user.profile_image,
      };
      setCookie(
        'user',
        JSON.stringify(state.user),
        cookieOptions(state.expiresAt),
      );
    },

    logout: (state) => {
      state.token = null;
      state.user = null;
      state.expiresAt = null;
      deleteCookie('accessToken');
      deleteCookie('user');
      deleteCookie('expiresAt');
    },
  },
});

export const {
  setCredentials,
  setAadhaarKycVerified,
  setVideoKycVerified,
  logout,
} = userSlice.actions;
export default userSlice.reducer;
