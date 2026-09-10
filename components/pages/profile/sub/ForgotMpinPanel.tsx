'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CheckCircle,
  Clock,
  KeyRound,
  Mail,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-input';
import { post } from '@/lib/api';
import { RootState } from '@/redux/store';
import { useSelector } from 'react-redux';

type Step = 'request' | 'verify' | 'done';

const verifySchema = z
  .object({
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    new_mpin: z.string().regex(/^\d{6}$/, 'MPIN must be exactly 6 digits'),
    confirm_mpin: z.string().regex(/^\d{6}$/, 'Confirm your new MPIN'),
  })
  .refine((d) => d.new_mpin === d.confirm_mpin, {
    path: ['confirm_mpin'],
    message: 'MPIN does not match',
  });

type VerifyValues = z.infer<typeof verifySchema>;

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

/** Keeps only the 6 leading digits a user types into an OTP / MPIN field. */
const digitsOnly = (e: React.FormEvent<HTMLInputElement>) => {
  e.currentTarget.value = e.currentTarget.value
    .replace(/[^0-9]/g, '')
    .slice(0, 6);
};

/**
 * MPIN reset for the signed-in user — sends an OTP to the account email, then
 * swaps in a new 6-digit MPIN. Mirrors the auth-screen "Forgot MPIN" flow.
 */
export default function ForgotMpinPanel(): JSX.Element {
  const email = useSelector((state: RootState) => state.user.user?.email ?? '');

  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);

  const verifyForm = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { otp: '', new_mpin: '', confirm_mpin: '' },
  });

  useEffect(() => {
    if (step !== 'verify' || expiresIn <= 0) return;
    const id = setInterval(
      () => setExpiresIn((v) => (v > 0 ? v - 1 : 0)),
      1000,
    );
    return () => clearInterval(id);
  }, [step, expiresIn]);

  const requestOtp = async () => {
    if (!email) {
      toast.error('No email is linked to this account.');
      return;
    }
    setLoading(true);
    try {
      const response = await post('/api/v1/auth/forgot-mpin', {
        email,
        otp_channel: 'EMAIL',
      });
      const { responseStatus, responseData } = response;
      if (!responseStatus?.status || !responseData?.token) {
        toast.error(responseStatus?.message || 'Unable to send OTP.');
        return;
      }
      setToken(responseData.token);
      setExpiresIn(responseData.expires_in_seconds || 600);
      setStep('verify');
      verifyForm.reset({ otp: '', new_mpin: '', confirm_mpin: '' });
      toast.success(responseStatus.message || 'OTP sent to your email.');
    } catch (err) {
      toast.error(extractError(err, 'Unable to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (values: VerifyValues) => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await post('/api/v1/auth/forgot-mpin/verify-otp', {
        token,
        otp: values.otp,
        new_mpin: values.new_mpin,
      });
      if (!response?.responseStatus?.status) {
        toast.error(response?.responseStatus?.message || 'Reset failed.');
        return;
      }
      setStep('done');
      setToken(null);
      toast.success('MPIN reset successfully');
    } catch (err) {
      toast.error(extractError(err, 'Reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10">
          <CheckCircle className="h-7 w-7 text-emerald-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-white">
            MPIN reset successful
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Use your new 6-digit MPIN the next time you sign in.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setStep('request');
            setExpiresIn(0);
          }}
          className="rounded-xl border-emerald-500/50 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset again
        </Button>
      </motion.div>
    );
  }

  if (step === 'verify') {
    return (
      <Form {...verifyForm}>
        <form
          onSubmit={verifyForm.handleSubmit(verify)}
          className="space-y-4"
          key="verify"
        >
          <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-800/30 p-3 sm:gap-3 sm:p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-8 sm:w-8">
              <Mail className="h-3.5 w-3.5 text-emerald-400 sm:h-4 sm:w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 sm:text-sm">
                OTP sent
              </p>
              <p className="mt-0.5 break-all text-[10px] leading-relaxed text-slate-500 sm:text-xs">
                Enter the 6-digit code sent to{' '}
                <span className="font-semibold text-emerald-400">{email}</span>,
                then choose a new MPIN.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormInput
              form={verifyForm}
              name="otp"
              label="6-digit OTP"
              placeholder="000000"
              className="tracking-[0.5em]"
              maxLength={6}
              onInput={digitsOnly}
            />
            <FormInput
              form={verifyForm}
              name="new_mpin"
              label="New MPIN"
              type="password"
              placeholder="••••••"
              icon={<KeyRound className="h-4 w-4" />}
              maxLength={6}
              onInput={digitsOnly}
            />
            <FormInput
              form={verifyForm}
              name="confirm_mpin"
              label="Confirm New MPIN"
              type="password"
              placeholder="••••••"
              icon={<KeyRound className="h-4 w-4" />}
              maxLength={6}
              onInput={digitsOnly}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={loading} className="mt-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Reset MPIN
            </Button>
            <button
              type="button"
              disabled={loading || expiresIn > 0}
              onClick={() => void requestOtp()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-slate-600"
            >
              <RotateCcw className="h-3 w-3" />
              Resend OTP
            </button>
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {expiresIn > 0
                ? `Expires in ${Math.floor(expiresIn / 60)}:${String(
                    expiresIn % 60,
                  ).padStart(2, '0')}`
                : 'OTP expired'}
            </span>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-800/30 p-3 sm:gap-3 sm:p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 sm:h-8 sm:w-8">
          <KeyRound className="h-3.5 w-3.5 text-cyan-400 sm:h-4 sm:w-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-300 sm:text-sm">
            MPIN Requirements
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 sm:mt-1 sm:text-xs">
            Your MPIN is exactly 6 digits and is required on every sign in. We
            will email a one-time code to{' '}
            <span className="font-semibold text-emerald-400">
              {email || 'your registered address'}
            </span>{' '}
            before letting you set a new one.
          </p>
        </div>
      </div>

      <Button type="button" loading={loading} onClick={() => void requestOtp()}>
        <Mail className="mr-2 h-4 w-4" />
        Send OTP
      </Button>
    </div>
  );
}
