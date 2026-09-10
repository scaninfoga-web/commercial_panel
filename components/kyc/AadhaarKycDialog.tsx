'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { AxiosError } from 'axios';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  Fingerprint,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { formatSentence } from '@/components/custom/functions/formatUtils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { setAadhaarKycVerified } from '@/redux/userSlice';
import type { AadhaarKycData } from '@/types/kyc';
// Parked until the remaining KYC sections land — see the result step below.
// import AadhaarKycDetails from './sub/AadhaarKycDetails';
// import KycLocationCheck from './sub/KycLocationCheck';
import KycConsent from './sub/KycConsent';
import KycPinInput from './sub/KycPinInput';
import KycRejectedNotice, {
  isDistanceRejection,
  parseRejection,
  type KycRejection,
} from './sub/KycRejectedNotice';

type Step = 'pending' | 'consent' | 'aadhaar' | 'otp' | 'rejected' | 'result';

const AADHAAR_REGEX = /^[2-9]\d{11}$/;
const RESEND_SECONDS = 60;
/** Headroom over the ~45s the backend needs to finish an OTP validation. */
const OTP_VALIDATE_TIMEOUT_SECONDS = 120;

interface AadhaarKycDialogProps {
  open: boolean;
  greeting: string;
  /** True when video KYC still follows — the success screen hands off to it. */
  videoKycPending?: boolean;
  /** Leaves for an ungated route — the only way out without verifying. */
  onLeave: () => void;
  /** Aadhaar is done: hand control back to the gate for the next stage. */
  onComplete: () => void;
}

/** A client-side abort — no response ever arrived, so the request timed out. */
function isTimeout(err: unknown): boolean {
  return err instanceof AxiosError && err.code === 'ECONNABORTED';
}

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

const STEP_META: Record<Step, { title: string; subtitle: string }> = {
  pending: {
    title: 'Pending KYC',
    subtitle: 'Complete KYC & Unlock Advance Feature',
  },
  consent: {
    title: 'KYC Verification & Platform Usage Disclaimer',
    subtitle: 'Read and accept before we verify your identity.',
  },
  aadhaar: {
    title: 'Aadhaar KYC',
    subtitle: 'Enter your 12-digit Aadhaar number to receive an OTP.',
  },
  otp: {
    title: 'Aadhaar KYC',
    subtitle: 'Enter the 6-digit OTP sent to your Aadhaar-linked mobile.',
  },
  rejected: {
    title: 'KYC Not Completed',
    subtitle: 'Your Aadhaar could not be verified from where you are.',
  },
  result: {
    title: 'Aadhaar Verified',
    subtitle: 'Your Aadhaar identity has been confirmed with UIDAI.',
  },
};

/**
 * The full Aadhaar KYC flow — pending notice → consent → Aadhaar number →
 * OTP → verified card, details and the 50 km location check.
 */
export default function AadhaarKycDialog({
  open,
  greeting,
  videoKycPending = false,
  onLeave,
  onComplete,
}: AadhaarKycDialogProps): JSX.Element {
  const dispatch = useDispatch();
  const [step, setStep] = useState<Step>('pending');
  const [loading, setLoading] = useState(false);
  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarError, setAadhaarError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [resendIn, setResendIn] = useState(0);
  const [kycData, setKycData] = useState<AadhaarKycData | null>(null);
  const [rejection, setRejection] = useState<KycRejection | null>(null);

  useEffect(() => {
    if (step !== 'otp' || resendIn <= 0) return;
    const id = setInterval(() => setResendIn((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, resendIn]);

  const generateOtp = useCallback(
    async (aadhaarNumber: string, resend = false) => {
      setLoading(true);
      try {
        const response = await post('/api/v1/kyc/aadhaar', {
          type: 'GENERATE_OTP',
          aadhaar_number: aadhaarNumber,
        });
        const { responseStatus } = response;
        if (!responseStatus?.status) {
          toast.error(responseStatus?.message || 'Failed to send OTP.');
          return;
        }
        setOtp(Array(6).fill(''));
        setResendIn(RESEND_SECONDS);
        setStep('otp');
        toast.success(
          responseStatus.message ||
            'OTP sent to the mobile number linked with your Aadhaar.',
          { id: 'aadhaar-otp' },
        );
      } catch (err) {
        toast.error(
          extractError(
            err,
            resend ? 'Failed to resend OTP.' : 'Failed to send OTP.',
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submitAadhaar = () => {
    const cleaned = aadhaar.replace(/\D/g, '');
    if (!AADHAAR_REGEX.test(cleaned)) {
      setAadhaarError('Aadhaar must be a valid 12-digit number');
      return;
    }
    setAadhaarError('');
    setAadhaar(cleaned);
    void generateOtp(cleaned);
  };

  const submitOtp = useCallback(
    async (code: string) => {
      setLoading(true);
      try {
        // UIDAI validation is slow: the backend logs in, pulls profile, bank
        // seeding, update and auth history, then uploads the photo and PDF to
        // S3 — measured at ~45s end to end. The 30s default in `lib/api` cuts
        // that off and burns the OTP, so this call gets its own budget.
        const response = await post(
          '/api/v1/kyc/aadhaar',
          {
            type: 'OTP_VALIDATE',
            aadhaar_number: aadhaar,
            otp: code,
          },
          {},
          OTP_VALIDATE_TIMEOUT_SECONDS,
        );
        const { responseStatus, responseData } = response;
        if (!responseStatus?.status || !responseData?.data) {
          const message = responseStatus?.message || 'OTP verification failed.';
          // The distance rejection needs explaining, not a one-line toast — it
          // takes over the dialog body with the reason and a map.
          if (isDistanceRejection(message)) {
            setRejection(parseRejection(message));
            setStep('rejected');
          } else {
            toast.error(message);
          }
          setOtp(Array(6).fill(''));
          return;
        }
        const data = responseData.data as AadhaarKycData;
        setKycData(data);
        // Backend has flipped the flag — mirror it, along with the UIDAI photo,
        // into the store/cookie so gated routes unlock and the avatar updates
        // without waiting for the next sign-in.
        dispatch(
          setAadhaarKycVerified({
            verified: true,
            aadhaarImage: data.profile_image,
          }),
        );
        setStep('result');
        toast.success('Aadhaar KYC completed successfully.');
      } catch (err) {
        // On a timeout the OTP has already been spent server-side — retyping it
        // can only fail, so send the user back for a fresh one.
        if (isTimeout(err)) {
          toast.error(
            'Verification is taking longer than expected. Please request a new OTP and try again.',
          );
          setStep('aadhaar');
        } else {
          // A 400 carries the rejection reason in its body — the distance one
          // takes over the dialog body, everything else stays a toast.
          const message = extractError(err, 'OTP verification failed.');
          if (isDistanceRejection(message)) {
            setRejection(parseRejection(message));
            setStep('rejected');
          } else {
            toast.error(message);
          }
        }
        setOtp(Array(6).fill(''));
      } finally {
        setLoading(false);
      }
    },
    [aadhaar, dispatch],
  );

  const meta = STEP_META[step];
  // Each step gets the width its content needs: the disclaimer is a long read,
  // the rejection carries a map and stat chips, everything else is a short form.
  const width =
    step === 'consent'
      ? 'sm:max-w-3xl'
      : step === 'rejected'
        ? 'sm:max-w-2xl'
        : 'sm:max-w-md';

  return (
    // Mandatory flow: `onOpenChange` is intentionally inert, so Escape, an
    // outside click or the close button can never dismiss the gate.
    <Dialog open={open}>
      <DialogContent
        className={cn(
          // The dialog itself never scrolls — it is a fixed-height column and
          // each step scrolls its own body instead.
          // `[&>button]:hidden` removes Radix's built-in close (X) button.
          'flex max-h-[90vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl [&>button]:hidden',
          width,
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 items-center text-center">
          <div
            className={cn(
              'mb-3 flex h-14 w-14 items-center justify-center rounded-xl border',
              step === 'result'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : step === 'rejected'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            )}
          >
            {step === 'result' ? (
              <BadgeCheck className="h-7 w-7" />
            ) : step === 'rejected' ? (
              <AlertTriangle className="h-7 w-7" />
            ) : step === 'pending' ? (
              <ShieldAlert className="h-7 w-7" />
            ) : (
              <Fingerprint className="h-7 w-7" />
            )}
          </div>
          <DialogTitle
            className={cn(
              'text-xl font-bold md:text-2xl',
              step === 'rejected'
                ? 'text-red-400'
                : 'bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent',
            )}
          >
            {meta.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-400">
            {meta.subtitle}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'mt-2 flex min-h-0 flex-1 flex-col',
              // The consent step manages its own inner scroll area; every
              // other step is short enough to scroll as a whole if it has to.
              step === 'consent'
                ? 'overflow-hidden'
                : 'scrollbar-custom overflow-y-auto',
            )}
          >
            {step === 'pending' && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center">
                  <p className="text-base font-semibold text-white">
                    {greeting},
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Your account is not KYC verified yet. Digital Intelligence
                    and Scaninfoga 365 Intelligence stay locked until your
                    Aadhaar identity is confirmed and your face is verified on
                    video.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: Sparkles, label: 'Advanced modules' },
                    { icon: ShieldCheck, label: 'Verified identity' },
                    { icon: Lock, label: 'Secure & confidential' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="text-xs text-slate-300">{label}</span>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  onClick={() => setStep('consent')}
                  className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  Complete KYC
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}

            {step === 'consent' && (
              <KycConsent onAgree={() => setStep('aadhaar')} />
            )}

            {step === 'aadhaar' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAadhaar();
                }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Fingerprint className="h-3.5 w-3.5 text-emerald-400" />
                    Aadhaar Number
                  </label>
                  <input
                    autoFocus
                    inputMode="numeric"
                    maxLength={12}
                    value={aadhaar}
                    onChange={(e) => {
                      setAadhaar(
                        e.target.value.replace(/\D/g, '').slice(0, 12),
                      );
                      if (aadhaarError) setAadhaarError('');
                    }}
                    placeholder="123456789012"
                    className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 text-sm tracking-[0.25em] text-white placeholder-slate-500 backdrop-blur-xl transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {aadhaarError && (
                    <p className="text-xs text-red-400">{aadhaarError}</p>
                  )}
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  An OTP will be sent to the mobile number linked with your
                  Aadhaar. Your Aadhaar details are stored securely and never
                  shared with third parties.
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  Send OTP
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <div className="space-y-5">
                <KycPinInput
                  digits={otp}
                  onChange={setOtp}
                  onComplete={(code) => void submitOtp(code)}
                  loading={loading}
                  accent="cyan"
                />

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    Verifying with UIDAI…
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {resendIn > 0
                      ? `Resend available in ${resendIn}s`
                      : 'You can resend the OTP now'}
                  </span>
                  <button
                    type="button"
                    disabled={resendIn > 0 || loading}
                    onClick={() => void generateOtp(aadhaar, true)}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-600"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Resend OTP
                  </button>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setStep('aadhaar');
                    setOtp(Array(6).fill(''));
                  }}
                  className="mx-auto block text-xs text-slate-500 transition hover:text-slate-300"
                >
                  Change Aadhaar number
                </button>
              </div>
            )}

            {step === 'rejected' && rejection && (
              <KycRejectedNotice rejection={rejection} />
            )}

            {step === 'result' && kycData && (
              <div className="flex flex-col items-center space-y-5 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl" />
                  <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-emerald-500/50 bg-slate-950 ring-4 ring-emerald-500/10">
                    {kycData.profile_image ? (
                      <Image
                        src={kycData.profile_image}
                        alt={kycData.name || 'Verified user'}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserCircle2 className="h-12 w-12 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500">
                    <BadgeCheck className="h-4 w-4 text-black" />
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">
                    {videoKycPending
                      ? 'Aadhaar verified successfully'
                      : 'Congratulations, your KYC is completed'}
                  </h3>
                  <p className="mt-2 break-words text-sm text-slate-400">
                    {formatSentence(kycData.name)} — your Aadhaar identity has
                    been verified with UIDAI.{' '}
                    {videoKycPending
                      ? 'One last step: a short video verification that matches your face to this photo.'
                      : 'Advanced intelligence modules are now unlocked.'}
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={onComplete}
                  className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  {videoKycPending ? 'Continue to Video KYC' : 'Done'}
                  {videoKycPending && (
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                  )}
                </Button>

                {/* TODO: restore once the remaining KYC sections land.
                <AadhaarKycDetails data={kycData} />
                <KycLocationCheck
                  address={kycData.address}
                  onProceed={onComplete}
                /> */}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* The escape hatch stays available on every step up to a successful
            OTP verification — once verified, `Done` is the only way out. */}
        {step !== 'result' && (
          // Wrapped in a div on purpose: `[&>button]:hidden` above kills every
          // direct button child (that is how Radix's close X is removed).
          <div className="mt-4 flex shrink-0 justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={onLeave}
              className="flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to dashboard
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
