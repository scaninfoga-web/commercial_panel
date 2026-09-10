import storage from 'redux-persist/lib/storage';
import { persistReducer } from 'redux-persist';
import { EXPIRY_SAFETY_MARGIN_SECONDS } from './userSlice';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['user', 'info', 'wallet'], // Persistence whitelist
};

/** Reads a JSON-encoded cookie without pulling in a client library. */
const readJsonCookie = (name: string): string | null => {
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
};

/**
 * The persisted session must never outlive its token. The `expiresAt` cookie
 * is written with the backend's `expires_at` minus a safety margin, so once it
 * is gone (or its timestamp has passed) the persisted `user` slice is stale and
 * gets dropped. `info` and `wallet` are left alone — they hold no credentials
 * and are collected before sign-in.
 */
if (typeof window !== 'undefined') {
  const expiresAt = readJsonCookie('expiresAt');
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const expired =
    !Number.isFinite(expiryMs) ||
    Date.now() >= expiryMs - EXPIRY_SAFETY_MARGIN_SECONDS * 1000;

  if (expired) {
    try {
      const persisted = localStorage.getItem('persist:root');
      if (persisted) {
        const parsed = JSON.parse(persisted);
        delete parsed.user;
        localStorage.setItem('persist:root', JSON.stringify(parsed));
      }
    } catch {
      localStorage.removeItem('persist:root');
    }
  }
}

export const getPersistedReducer = (rootReducer: any) => {
  return persistReducer(persistConfig, rootReducer);
};
