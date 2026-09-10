'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KycPinInputProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  onComplete: (code: string) => void;
  loading?: boolean;
  masked?: boolean;
  accent?: 'emerald' | 'cyan';
}

const ACCENTS = {
  emerald: {
    ring: 'focus:border-emerald-400/60 focus:ring-emerald-400/20 focus:shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]',
    filled: 'border-emerald-500/40 bg-emerald-500/10',
  },
  cyan: {
    ring: 'focus:border-cyan-400/60 focus:ring-cyan-400/20 focus:shadow-[0_0_12px_-2px_rgba(6,182,212,0.3)]',
    filled: 'border-cyan-500/40 bg-cyan-500/10',
  },
} as const;

/**
 * Six single-digit boxes with auto-advance, backspace-rewind and paste support
 * — the same interaction model as the sign-in MPIN/OTP entry.
 */
export default function KycPinInput({
  digits,
  onChange,
  onComplete,
  loading = false,
  masked = false,
  accent = 'cyan',
}: KycPinInputProps): JSX.Element {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const colors = ACCENTS[accent];

  useEffect(() => {
    const timer = setTimeout(() => refs.current[0]?.focus(), 60);
    return () => clearTimeout(timer);
  }, []);

  const commit = (next: string[]) => {
    onChange(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const handleChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const next = [...digits];

    if (!cleaned) {
      next[index] = '';
      onChange(next);
      return;
    }
    if (cleaned.length > 1) {
      cleaned
        .slice(0, 6 - index)
        .split('')
        .forEach((ch, i) => {
          next[index + i] = ch;
        });
      refs.current[Math.min(index + cleaned.length, 5)]?.focus();
      commit(next);
      return;
    }
    next[index] = cleaned;
    if (index < 5) refs.current[index + 1]?.focus();
    commit(next);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    pasted.split('').forEach((ch, i) => (next[i] = ch));
    refs.current[Math.min(pasted.length, 5)]?.focus();
    commit(next);
  };

  const filled = digits.every((d) => d !== '');

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-center gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type={masked ? 'password' : 'text'}
            inputMode="numeric"
            value={digit}
            disabled={loading}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'h-14 w-12 rounded-xl border border-slate-700 bg-slate-900/50 text-center text-xl font-bold text-white outline-none transition-all duration-200 focus:ring-1 disabled:opacity-40',
              colors.ring,
              digit && colors.filled,
            )}
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
