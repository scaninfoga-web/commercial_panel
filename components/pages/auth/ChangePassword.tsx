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
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/ui/form-input';
import { post } from '@/lib/api';

type OtpChannel = 'EMAIL' | 'WHATSAPP';
type Step = 'request' | 'verify' | 'done';

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

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

interface ChangePasswordProps {
  onDone: () => void;
}

export default function ChangePassword({ onDone }: ChangePasswordProps) {
  const [channel, setChannel] = useState<OtpChannel>('EMAIL');
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);

  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
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

  const requestOtp = async (values: z.infer<typeof requestSchema>) => {
    setLoading(true);
    try {
      const response = await post('/api/v1/auth/forgot-mpin', {
        email: values.email,
        otp_channel: channel,
      });
      const { responseStatus, responseData } = response;
      if (!responseStatus?.status || !responseData?.token) {
        toast.error(responseStatus?.message || 'Unable to send OTP.');
        return;
      }
      setToken(responseData.token);
      setEmail(values.email);
      setExpiresIn(responseData.expires_in_seconds || 600);
      setStep('verify');
      toast.success(
        `OTP sent via ${channel === 'WHATSAPP' ? 'WhatsApp' : 'email'}`,
      );
    } catch (err) {
      toast.error(extractError(err, 'Unable to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (values: z.infer<typeof verifySchema>) => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await post('/api/v1/auth/forgot-mpin/verify-otp', {
        token,
        otp: values.otp,
        new_mpin: values.new_mpin,
      });
      if (!response.responseStatus?.status) {
        toast.error(response.responseStatus?.message || 'Reset failed.');
        return;
      }
      setStep('done');
      toast.success('MPIN reset successful');
    } catch (err) {
      toast.error(extractError(err, 'Reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center space-y-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">
            MPIN reset successful
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with your new MPIN for {email}.
          </p>
        </div>
        <Button
          type="button"
          onClick={onDone}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <Form {...verifyForm}>
        <form onSubmit={verifyForm.handleSubmit(verify)} className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-sm text-slate-400">
            OTP sent to{' '}
            <span className="font-semibold text-emerald-400">{email}</span> via{' '}
            {channel === 'WHATSAPP' ? 'WhatsApp' : 'email'}.
          </div>

          <FormInput
            form={verifyForm}
            name="otp"
            label="6-digit OTP"
            placeholder="000000"
            className="tracking-[0.5em]"
            maxLength={6}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value
                .replace(/[^0-9]/g, '')
                .slice(0, 6);
            }}
          />
          <FormInput
            form={verifyForm}
            name="new_mpin"
            label="New MPIN"
            type="password"
            placeholder="••••••"
            icon={<KeyRound className="h-4 w-4" />}
            maxLength={6}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value
                .replace(/[^0-9]/g, '')
                .slice(0, 6);
            }}
          />
          <FormInput
            form={verifyForm}
            name="confirm_mpin"
            label="Confirm new MPIN"
            type="password"
            placeholder="••••••"
            icon={<KeyRound className="h-4 w-4" />}
            maxLength={6}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value
                .replace(/[^0-9]/g, '')
                .slice(0, 6);
            }}
          />

          <Button
            type="submit"
            loading={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Reset MPIN
          </Button>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {expiresIn > 0
                ? `Expires in ${Math.floor(expiresIn / 60)}:${String(
                    expiresIn % 60,
                  ).padStart(2, '0')}`
                : 'OTP expired'}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setToken(null);
                verifyForm.reset({
                  otp: '',
                  new_mpin: '',
                  confirm_mpin: '',
                });
              }}
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Change email
            </button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...requestForm}>
      <form
        onSubmit={requestForm.handleSubmit(requestOtp)}
        className="space-y-5"
      >
        <FormInput
          form={requestForm}
          name="email"
          label="Registered email"
          type="email"
          placeholder="you@company.com"
          icon={<Mail className="h-4 w-4" />}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-200">Send OTP via</p>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
            {(
              [
                { value: 'EMAIL', label: 'Email', icon: Mail },
                {
                  value: 'WHATSAPP',
                  label: 'WhatsApp',
                  icon: MessageCircle,
                },
              ] as const
            ).map(({ value, label, icon: Icon }) => {
              const active = channel === value;
              return (
                <motion.button
                  key={value}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setChannel(value)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-black shadow-lg shadow-emerald-500/20'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
        >
          Send OTP
        </Button>
      </form>
    </Form>
  );
}
