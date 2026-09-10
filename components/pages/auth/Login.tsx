'use client';

/**
 * Login — Scaninfoga Commercial Intelligence Portal
 * ─────────────────────────────────────────────────────────────
 * Functionality: Redux-based session storage, tier-gated access
 * (ADMIN + COMMERCIAL only), single OTP channel (EMAIL only).
 * Same API contracts: /auth/signin, /auth/signin/verify-otp,
 * /auth/forgot-mpin, /auth/forgot-mpin/verify-otp
 *
 * This component requires the app to be wrapped in a Redux
 * <Provider> at the root layout — see providers.tsx. Without it,
 * useAppDispatch() throws:
 *   "could not find react-redux context value..."
 *
 * PRODUCTION FIXES APPLIED vs the version you pasted:
 *   1. Removed unused `useDispatch` import (only useAppDispatch
 *      is actually used — the raw import was dead code).
 *   2. Restored `{ withCredentials: true }` on the /signin and
 *      /signin/verify-otp calls — present in your original
 *      working (non-Redux) Login, missing here. Needed if your
 *      API is on a different origin/subdomain and relies on
 *      cookies for session/CSRF.
 *
 * NOTE: adjust the import paths below (`@/...`) to match your
 * project's actual folder structure if they differ.
 * ─────────────────────────────────────────────────────────────
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AxiosError } from 'axios';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Globe2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RotateCcw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { post } from '@/lib/api';
import { setCredentials, type Gender, type User } from '@/redux/userSlice';
// Adjust this path to wherever EmailInputAutocomplete actually lives.
import EmailInputAutocomplete from '@/components/custom/EmailInputAutocomplete';
import { useAppDispatch } from '@/redux/hooks';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */
type OtpChannel = 'EMAIL';
type SigninStep = 'mpin' | 'otp';
type ForgotStep = 'otp' | 'new-mpin';

/* ────────────────────────────────────────────────────────────
   Helpers (logic unchanged)
   ──────────────────────────────────────────────────────────── */
function extractError(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return (
      err.response?.data?.responseStatus?.message ||
      err.response?.data?.message ||
      fallback
    );
  }
  return fallback;
}

const REGISTERED_TIERS = new Set<User['tier']>([
  'ADMIN',
  'NORMAL',
  'COMMERCIAL',
  'COOPERATIVE',
  'COOPERATIVE_MEMBER',
]);

function normalizeTierValue(value: unknown): User['tier'] | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'SUPER_ADMIN') return 'ADMIN';
    if (normalized === 'COMM') return 'COMMERCIAL';
    if (normalized === 'ADMIN' || normalized === 'COMMERCIAL') {
      return normalized as User['tier'];
    }
    if (REGISTERED_TIERS.has(normalized as User['tier'])) {
      return normalized as User['tier'];
    }
    return null;
  }

  if (typeof value === 'number') {
    return null;
  }

  return null;
}

function normalizeTier(raw: any): User['tier'] | null {
  const seen = new Set<any>();
  const queue: any[] = [raw];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === null || current === undefined || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === 'string' || typeof current === 'number') {
      const tier = normalizeTierValue(current);
      if (tier) return tier;
      continue;
    }

    if (typeof current === 'object') {
      const keys = Object.keys(current as Record<string, unknown>);

      for (const key of keys) {
        const lowered = key.toLowerCase();
        const value = (current as Record<string, unknown>)[key];

        if (
          ['tier', 'user_type', 'usertype', 'userType', 'role', 'role_name', 'rolename', 'userRole', 'user_role', 'accountType', 'type', 'access_level', 'accessLevel'].includes(lowered) ||
          lowered.includes('tier') ||
          lowered.includes('role') ||
          lowered.includes('account') ||
          lowered.includes('access')
        ) {
          const tier = normalizeTierValue(value);
          if (tier) return tier;
        }
      }

      queue.push(...Object.values(current as Record<string, unknown>));
    }
  }

  return null;
}

function normalizeUser(raw: any): User {
  const gender = String(raw?.gender || '').toUpperCase();
  return {
    name: raw?.name,
    email: raw?.email,
    mobile_number: raw?.mobile_number,
    gender:
      gender === 'MALE' || gender === 'FEMALE' ? (gender as Gender) : null,
    is_aadhaar_kyc: Boolean(raw?.is_aadhaar_kyc),
    is_video_kyc: Boolean(raw?.is_video_kyc),
    tier: normalizeTier(raw) ?? 'NORMAL',
    profile_image: raw?.profile_image ?? null,
    aadhaar_image: raw?.aadhaar_image ?? null,
    date_of_birth: raw?.date_of_birth ?? null,
    aadhaar_mobile_number: raw?.aadhaar_mobile_number ?? null,
  };
}

function pinDigitChange(
  index: number,
  value: string,
  digits: string[],
  setDigits: (d: string[]) => void,
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  onComplete: (code: string) => void,
) {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) {
    const next = [...digits];
    next[index] = '';
    setDigits(next);
    return;
  }
  if (cleaned.length > 1) {
    const next = [...digits];
    cleaned
      .slice(0, 6 - index)
      .split('')
      .forEach((ch, i) => {
        next[index + i] = ch;
      });
    setDigits(next);
    refs.current[Math.min(index + cleaned.length, 5)]?.focus();
    if (next.every((d) => d !== '')) onComplete(next.join(''));
    return;
  }
  const next = [...digits];
  next[index] = cleaned;
  setDigits(next);
  if (index < 5) refs.current[index + 1]?.focus();
  if (next.every((d) => d !== '')) onComplete(next.join(''));
}

function pinKeyDown(
  index: number,
  e: KeyboardEvent<HTMLInputElement>,
  digits: string[],
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
) {
  if (e.key === 'Backspace' && !digits[index] && index > 0)
    refs.current[index - 1]?.focus();
}

function pinPaste(
  e: React.ClipboardEvent,
  setDigits: (d: string[]) => void,
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  onComplete: (code: string) => void,
) {
  e.preventDefault();
  const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
  if (!pasted) return;
  const next = Array(6).fill('');
  pasted.split('').forEach((ch, i) => (next[i] = ch));
  setDigits(next);
  refs.current[Math.min(pasted.length, 5)]?.focus();
  if (next.every((d) => d !== '')) onComplete(next.join(''));
}

/* ────────────────────────────────────────────────────────────
   Login
   ──────────────────────────────────────────────────────────── */
export default function Login(): JSX.Element {
  const dispatch = useAppDispatch();
  const reduceMotion = !!useReducedMotion();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const [signinOpen, setSigninOpen] = useState(false);
  const [signinStep, setSigninStep] = useState<SigninStep>('mpin');
  const [signinToken, setSigninToken] = useState<string | null>(null);
  const [signinMpinCode, setSigninMpinCode] = useState('');
  const [signinOtpDest, setSigninOtpDest] = useState('');
  const [mpin, setMpin] = useState<string[]>(Array(6).fill(''));
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const mpinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('otp');
  const [forgotToken, setForgotToken] = useState<string | null>(null);
  const [forgotOtpDest, setForgotOtpDest] = useState('');
  const [forgotOtp, setForgotOtp] = useState<string[]>(Array(6).fill(''));
  const [newMpin, setNewMpin] = useState<string[]>(Array(6).fill(''));
  const forgotOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newMpinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSigninChannelSelect = useCallback(
    async (channel: OtpChannel, mpinCode?: string) => {
      try {
        setLoading(true);
        const response = await post(
          '/api/v1/auth/signin',
          {
            email: email.trim(),
            mpin: mpinCode || signinMpinCode,
            otp_channel: channel,
          },
          { withCredentials: true },
        );
        const { responseData, responseStatus } = response;

        if (!responseStatus?.status) {
          toast.error(responseStatus?.message || 'Invalid credentials.');
          setSigninStep('mpin');
          setMpin(Array(6).fill(''));
          setSigninMpinCode('');
          setTimeout(() => mpinRefs.current[0]?.focus(), 50);
          return;
        }

        const signedInUser = normalizeUser(responseData?.user ?? responseData ?? null);
        const userTier = normalizeTier(responseData?.user ?? responseData ?? null)?.toUpperCase();

        if (userTier && !['ADMIN', 'COMMERCIAL'].includes(userTier)) {
          toast.error('Only Admin and Commercial users can access this portal.');
          setSigninStep('mpin');
          setMpin(Array(6).fill(''));
          setSigninMpinCode('');
          setTimeout(() => mpinRefs.current[0]?.focus(), 50);
          return;
        }

        if (responseData?.requires_otp) {
          setSigninToken(responseData.token);
          setSigninOtpDest('email');
          setSigninStep('otp');
          setOtp(Array(6).fill(''));
          toast.info(responseStatus?.message || 'OTP sent.');
        } else if (responseData?.access_token) {
          dispatch(
            setCredentials({
              token: responseData.access_token,
              user: signedInUser,
              expiresAt: responseData.expires_at ?? null,
            }),
          );
          toast.success('Signed in successfully', { duration: 900 });
          setTimeout(() => (window.location.href = '/dashboard'), 400);
        }
      } catch (err) {
        toast.error(extractError(err, 'Invalid credentials. Try again.'));
        setSigninStep('mpin');
        setMpin(Array(6).fill(''));
        setSigninMpinCode('');
        setTimeout(() => mpinRefs.current[0]?.focus(), 50);
      } finally {
        setLoading(false);
      }
    },
    [email, signinMpinCode, dispatch],
  );

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError('');
    setMpin(Array(6).fill(''));
    setOtp(Array(6).fill(''));
    setSigninStep('mpin');
    setSigninMpinCode('');
    setSigninOpen(true);
  };

  const handleMpinComplete = useCallback(
    (code: string) => {
      setSigninMpinCode(code);
      handleSigninChannelSelect('EMAIL', code);
    },
    [handleSigninChannelSelect],
  );

  const handleOtpComplete = useCallback(
    async (code: string) => {
      if (!signinToken) return;
      try {
        setLoading(true);
        const response = await post(
          '/api/v1/auth/signin/verify-otp',
          {
            token: signinToken,
            otp: code,
          },
          { withCredentials: true },
        );
        const { responseData, responseStatus } = response;
        if (!responseStatus?.status || !responseData?.access_token) {
          toast.error(responseStatus?.message || 'OTP verification failed.');
          setOtp(Array(6).fill(''));
          setTimeout(() => otpRefs.current[0]?.focus(), 50);
          return;
        }

        const signedInUser = normalizeUser(responseData?.user ?? responseData ?? null);
        const userTier = normalizeTier(responseData?.user ?? responseData ?? null)?.toUpperCase();

        if (userTier && !['ADMIN', 'COMMERCIAL'].includes(userTier)) {
          toast.error('Only Admin and Commercial users can access this portal.');
          setOtp(Array(6).fill(''));
          setTimeout(() => otpRefs.current[0]?.focus(), 50);
          return;
        }

        dispatch(
          setCredentials({
            token: responseData.access_token,
            user: signedInUser,
            expiresAt: responseData.expires_at ?? null,
          }),
        );
        toast.success('Signed in successfully', { duration: 900 });
        setTimeout(() => (window.location.href = '/dashboard'), 400);
      } catch (err) {
        toast.error(extractError(err, 'Invalid OTP. Try again.'));
        setOtp(Array(6).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } finally {
        setLoading(false);
      }
    },
    [signinToken, dispatch],
  );

  const handleForgotChannelSelect = useCallback(
    async (channel: OtpChannel) => {
      try {
        setLoading(true);
        const response = await post('/api/v1/auth/forgot-mpin', {
          email: email.trim(),
          otp_channel: channel,
        });
        const { responseData, responseStatus } = response;
        if (!responseStatus?.status || !responseData?.token) {
          toast.error(responseStatus?.message || 'Failed to send OTP.');
          return;
        }
        setForgotToken(responseData.token);
        setForgotOtpDest('email');
        setForgotStep('otp');
        setForgotOtp(Array(6).fill(''));
        toast.info(responseStatus?.message || 'OTP sent.');
      } catch (err) {
        toast.error(extractError(err, 'Failed to send OTP.'));
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  const handleForgotClick = () => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter your email first, then click Forgot MPIN');
      return;
    }
    setEmailError('');
    setForgotStep('otp');
    setForgotOtp(Array(6).fill(''));
    setNewMpin(Array(6).fill(''));
    setForgotToken(null);
    setForgotOpen(true);
    handleForgotChannelSelect('EMAIL');
  };

  const handleForgotOtpComplete = useCallback((code: string) => {
    setForgotOtp(code.split(''));
    setForgotStep('new-mpin');
    setNewMpin(Array(6).fill(''));
  }, []);

  const handleNewMpinComplete = useCallback(
    async (code: string) => {
      if (!forgotToken) return;
      try {
        setLoading(true);
        const response = await post('/api/v1/auth/forgot-mpin/verify-otp', {
          token: forgotToken,
          otp: forgotOtp.join(''),
          new_mpin: code,
        });
        if (!response?.responseStatus?.status) {
          toast.error(
            response?.responseStatus?.message || 'Failed to reset MPIN.',
          );
          setNewMpin(Array(6).fill(''));
          setTimeout(() => newMpinRefs.current[0]?.focus(), 50);
          return;
        }
        toast.success(
          response?.responseStatus?.message ||
            'MPIN reset successfully. Please sign in.',
          { duration: 2500 },
        );
        setForgotOpen(false);
        setForgotToken(null);
      } catch (err) {
        const msg = extractError(err, 'Failed to reset MPIN.');
        toast.error(msg);
        if (msg.toLowerCase().includes('otp')) {
          setForgotStep('otp');
          setForgotOtp(Array(6).fill(''));
        } else {
          setNewMpin(Array(6).fill(''));
          setTimeout(() => newMpinRefs.current[0]?.focus(), 50);
        }
      } finally {
        setLoading(false);
      }
    },
    [forgotToken, forgotOtp],
  );

  const signinStepIdx = signinStep === 'mpin' ? 0 : 1;
  const forgotStepIdx = forgotStep === 'otp' ? 0 : 1;

  return (
    <>
      <div className="relative grid min-h-[100dvh] w-full grid-cols-1 overflow-hidden bg-[#05070B] lg:grid-cols-[1.1fr_1fr]">
        <BrandPanel reduceMotion={reduceMotion} />

        {/* ─── RIGHT — FORM PANEL ─── */}
        <div className="relative flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="pointer-events-none absolute inset-0 lg:hidden">
            <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 w-full max-w-[420px]"
          >
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Scaninfoga</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400/80">
                  Commercial Portal
                </p>
              </div>
            </div>

            <div className="mb-8 space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Sign in
              </h2>
              <p className="text-sm text-zinc-400">
                Sign in to continue to the Scaninfoga Commercial Portal.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400"
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-400/70" />
                  Email
                </label>
                <div className="relative">
                  <EmailInputAutocomplete
                    value={email}
                    onChange={(val: string) => {
                      setEmail(val);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="business@company.com"
                    error={!!emailError}
                    maxSuggestions={4}
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-400" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="group relative h-11 w-full overflow-hidden rounded-xl bg-emerald-500 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_8px_32px_-8px_rgba(16,185,129,0.6)] transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleForgotClick}
                disabled={loading}
                className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
              >
                Forgot your MPIN?
              </button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-5">
              <p className="text-[11px] text-zinc-500">
                Scaninfoga Commercial Security
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Secure access
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
         SIGNIN DIALOG (MPIN → OTP)
         ═══════════════════════════════════════════════════ */}
      <Dialog
        open={signinOpen}
        onOpenChange={(open) => {
          if (loading) return;
          setSigninOpen(open);
          if (!open) {
            setSigninStep('mpin');
            setSigninToken(null);
            setSigninMpinCode('');
          }
        }}
      >
        <DialogContent
          className="w-[calc(100%-2rem)] rounded-2xl border-white/10 bg-[#0A0E17] sm:max-w-[420px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 flex items-center gap-2">
              <StepDot
                active={signinStepIdx === 0}
                done={signinStepIdx > 0}
                label="1"
                accent="emerald"
              />
              <div
                className={`h-px w-6 transition-colors duration-300 ${
                  signinStepIdx > 0 ? 'bg-emerald-400' : 'bg-white/10'
                }`}
              />
              <StepDot active={signinStepIdx === 1} done={false} label="2" accent="emerald" />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={signinStep}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    signinStep === 'mpin'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-cyan-500/10 text-cyan-400'
                  }`}
                >
                  {signinStep === 'mpin' ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <KeyRound className="h-5 w-5" />
                  )}
                </div>
                <DialogTitle className="text-lg font-semibold text-white">
                  {signinStep === 'mpin' ? 'Enter your MPIN' : 'Enter OTP'}
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400">
                  {signinStep === 'mpin'
                    ? 'Enter your 6-digit MPIN to access your commercial account.'
                    : `We sent a verification code to your ${signinOtpDest || 'email'}. Enter it below.`}
                </DialogDescription>
              </motion.div>
            </AnimatePresence>
          </DialogHeader>

          <AnimatePresence mode="wait">
            <motion.div
              key={signinStep}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mt-2"
            >
              {signinStep === 'mpin' && (
                <PinInput
                  digits={mpin}
                  onChange={(i, v) =>
                    pinDigitChange(i, v, mpin, setMpin, mpinRefs, handleMpinComplete)
                  }
                  onKeyDown={(i, e) => pinKeyDown(i, e, mpin, mpinRefs)}
                  onPaste={(e) => pinPaste(e, setMpin, mpinRefs, handleMpinComplete)}
                  refs={mpinRefs}
                  loading={loading}
                  masked
                  accentColor="emerald"
                  ariaLabel="MPIN"
                />
              )}
              {signinStep === 'otp' && (
                <PinInput
                  digits={otp}
                  onChange={(i, v) => pinDigitChange(i, v, otp, setOtp, otpRefs, handleOtpComplete)}
                  onKeyDown={(i, e) => pinKeyDown(i, e, otp, otpRefs)}
                  onPaste={(e) => pinPaste(e, setOtp, otpRefs, handleOtpComplete)}
                  refs={otpRefs}
                  loading={loading}
                  masked={false}
                  accentColor="cyan"
                  ariaLabel="OTP"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {loading && (
            <div className="flex items-center justify-center gap-2 pt-1 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              {signinStep === 'mpin' ? 'Authenticating...' : 'Verifying...'}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════
         FORGOT MPIN DIALOG (OTP → New MPIN)
         ═══════════════════════════════════════════════════ */}
      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          if (loading) return;
          setForgotOpen(open);
          if (!open) {
            setForgotStep('otp');
            setForgotToken(null);
          }
        }}
      >
        <DialogContent
          className="w-[calc(100%-2rem)] rounded-2xl border-white/10 bg-[#0A0E17] sm:max-w-[420px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-4 flex items-center gap-2">
              <StepDot
                active={forgotStepIdx === 0}
                done={forgotStepIdx > 0}
                label="1"
                accent="amber"
              />
              <div
                className={`h-px w-6 transition-colors duration-300 ${
                  forgotStepIdx > 0 ? 'bg-amber-400' : 'bg-white/10'
                }`}
              />
              <StepDot active={forgotStepIdx === 1} done={false} label="2" accent="amber" />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={forgotStep}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    forgotStep === 'otp'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {forgotStep === 'otp' ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <RotateCcw className="h-5 w-5" />
                  )}
                </div>
                <DialogTitle className="text-lg font-semibold text-white">
                  {forgotStep === 'otp' ? 'Enter OTP' : 'Set new MPIN'}
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400">
                  {forgotStep === 'otp'
                    ? `We sent a verification code to your ${forgotOtpDest || 'email'}. Enter it below.`
                    : 'Create a new 6-digit MPIN for your commercial account.'}
                </DialogDescription>
              </motion.div>
            </AnimatePresence>
          </DialogHeader>

          <AnimatePresence mode="wait">
            <motion.div
              key={forgotStep}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mt-2"
            >
              {forgotStep === 'otp' && (
                <PinInput
                  digits={forgotOtp}
                  onChange={(i, v) =>
                    pinDigitChange(i, v, forgotOtp, setForgotOtp, forgotOtpRefs, handleForgotOtpComplete)
                  }
                  onKeyDown={(i, e) => pinKeyDown(i, e, forgotOtp, forgotOtpRefs)}
                  onPaste={(e) =>
                    pinPaste(e, setForgotOtp, forgotOtpRefs, handleForgotOtpComplete)
                  }
                  refs={forgotOtpRefs}
                  loading={loading}
                  masked={false}
                  accentColor="emerald"
                  ariaLabel="OTP"
                />
              )}
              {forgotStep === 'new-mpin' && (
                <PinInput
                  digits={newMpin}
                  onChange={(i, v) =>
                    pinDigitChange(i, v, newMpin, setNewMpin, newMpinRefs, handleNewMpinComplete)
                  }
                  onKeyDown={(i, e) => pinKeyDown(i, e, newMpin, newMpinRefs)}
                  onPaste={(e) => pinPaste(e, setNewMpin, newMpinRefs, handleNewMpinComplete)}
                  refs={newMpinRefs}
                  loading={loading}
                  masked
                  accentColor="amber"
                  ariaLabel="new MPIN"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {loading && (
            <div className="flex items-center justify-center gap-2 pt-1 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              {forgotStep === 'new-mpin' ? 'Resetting MPIN...' : 'Processing...'}
            </div>
          )}

          {forgotStep === 'new-mpin' && !loading && (
            <button
              type="button"
              onClick={() => {
                setForgotStep('otp');
                setForgotOtp(Array(6).fill(''));
              }}
              className="mx-auto mt-1 block text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Re-enter OTP
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   Brand panel (left side, desktop only)
   ──────────────────────────────────────────────────────────── */
function BrandPanel({ reduceMotion }: { reduceMotion: boolean }) {
  const stats = [
    { icon: Activity, label: 'Uptime', value: '99.99%' },
    { icon: Globe2, label: 'Regions', value: '14' },
    { icon: Fingerprint, label: 'MFA', value: 'Enforced' },
  ];

  return (
    <div className="relative hidden overflow-hidden border-r border-emerald-500/10 lg:flex">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(16,185,129,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.25) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 30% 40%, #000 40%, transparent 100%)',
        }}
      />

      {/* Signature touch: a scan line sweeping the grid — a nod to "Scaninfoga" */}
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent"
          initial={{ top: '-10%' }}
          animate={{ top: ['-10%', '110%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <div className="absolute -top-32 -left-32 h-[440px] w-[440px] rounded-full bg-emerald-500/20 blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-cyan-500/10 blur-[140px]" />

      <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-emerald-500/30 blur-md" />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium leading-none text-white">
              Scaninfoga
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-emerald-400/80">
              Commercial Portal
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-md space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Secure session — TLS 1.3
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-white xl:text-6xl">
            Power your business
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              with trusted intelligence.
            </span>
          </h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-zinc-400">
            Secure access to Scaninfoga commercial intelligence, verification
            tools, and business operations.
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]"
        >
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-2 bg-[#05070B] p-5">
              <Icon className="h-4 w-4 text-emerald-400/80" />
              <p className="text-lg font-semibold text-white">{value}</p>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Step dot
   ──────────────────────────────────────────────────────────── */
function StepDot({
  active,
  done,
  label,
  accent,
}: {
  active: boolean;
  done: boolean;
  label: string;
  accent: 'emerald' | 'amber';
}) {
  const doneClass =
    accent === 'emerald' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black';
  const activeClass =
    accent === 'emerald'
      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-400 shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)]'
      : 'border-amber-400/50 bg-amber-500/15 text-amber-400 shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]';
  return (
    <div
      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
        done
          ? doneClass
          : active
            ? `border ${activeClass}`
            : 'border border-white/10 bg-white/[0.03] text-zinc-600'
      }`}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : label}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Pin input (responsive: shrinks gracefully on narrow phones)
   ──────────────────────────────────────────────────────────── */
function PinInput({
  digits,
  onChange,
  onKeyDown,
  onPaste,
  refs,
  loading,
  masked,
  accentColor,
  ariaLabel,
}: {
  digits: string[];
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  loading: boolean;
  masked: boolean;
  accentColor: 'emerald' | 'cyan' | 'amber';
  ariaLabel: string;
}) {
  useEffect(() => {
    const timer = setTimeout(() => refs.current[0]?.focus(), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = digits.every((d) => d !== '');
  const colorMap = {
    emerald: {
      ring: 'focus:border-emerald-400/60 focus:ring-emerald-400/20 focus:shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]',
      filled: 'border-emerald-500/30 bg-emerald-500/[0.06]',
    },
    cyan: {
      ring: 'focus:border-cyan-400/60 focus:ring-cyan-400/20 focus:shadow-[0_0_12px_-2px_rgba(6,182,212,0.3)]',
      filled: 'border-cyan-500/30 bg-cyan-500/[0.06]',
    },
    amber: {
      ring: 'focus:border-amber-400/60 focus:ring-amber-400/20 focus:shadow-[0_0_12px_-2px_rgba(245,158,11,0.3)]',
      filled: 'border-amber-500/30 bg-amber-500/[0.06]',
    },
  } as const;
  const colors = colorMap[accentColor];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-center gap-2 sm:gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type={masked ? 'password' : 'text'}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`${ariaLabel} digit ${i + 1}`}
            value={digit}
            disabled={loading}
            onChange={(e) => onChange(i, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            className={`h-12 w-10 rounded-xl border border-white/10 bg-white/[0.04] text-center text-lg font-semibold text-white outline-none transition-all duration-200 focus:ring-1 disabled:opacity-40 sm:h-14 sm:w-12 sm:text-xl ${colors.ring} ${
              digit ? colors.filled : ''
            }`}
          />
        ))}
      </div>
      {filled && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-1.5 text-xs text-emerald-400"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Submitting...
        </motion.div>
      )}
    </div>
  );
}