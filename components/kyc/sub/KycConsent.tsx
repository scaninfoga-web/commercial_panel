'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface KycConsentProps {
  onAgree: () => void;
}

const PARAGRAPHS = [
  'Before you can access our advanced features and intelligence services, we require every user to complete Full KYC Verification. This isn’t just a formality — it’s how we keep the platform secure, compliant, and trustworthy for everyone who uses it.',
  'Once you complete KYC, you’re confirming your identity with us, and that helps us keep bad actors off the platform. It also means that from that point on, you’re responsible for what happens under your account — every search, every investigation, every action taken. If your account is ever misused, or used for anything unauthorized or unlawful, that responsibility sits with you, not with us. Scaninfoga Solutions Pvt. Ltd. will not be held liable for how individual users choose to use the platform.',
  'We keep an eye on activity across the platform to catch anything that looks off. If something on your account looks suspicious, unusual, or potentially unlawful, we’ll reach out and ask you to explain or provide documentation. If we don’t hear back with a satisfactory answer within a reasonable time, we may need to suspend or restrict your access while we look into it further.',
  'On our end, your KYC details are stored securely and kept confidential. We don’t hand your information over to third parties — the only exception is when we’re legally required to, such as in response to a valid court order or a request from a law enforcement or government authority. In those cases, we’ll comply with the law, as any responsible business would.',
  'Protecting your data and your trust is something we take seriously, and we’ll continue investing in the security and privacy standards needed to back that up.',
];

/**
 * Step 2 of the KYC flow — the platform-usage disclaimer the user must read
 * and accept before any Aadhaar data is collected.
 */
export default function KycConsent({ onAgree }: KycConsentProps): JSX.Element {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-slate-300">
          Please read the disclaimer below in full. Accepting it records your
          consent for identity verification and platform usage.
        </p>
      </div>

      {/* the only scrollable region in the whole flow */}
      <div className="scrollbar-custom min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-5">
        {PARAGRAPHS.map((text, i) => (
          <p
            key={i}
            className="break-words text-sm leading-relaxed text-slate-300"
          >
            {text}
          </p>
        ))}

        <div className="border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-400">Warm regards,</p>
          <p className="mt-1 text-sm font-semibold text-white">
            Mitu Kumar Nahak
          </p>
          <p className="text-xs text-slate-400">
            Founder, Managing Director &amp; CEO
          </p>
          <p className="text-xs text-emerald-400">
            Scaninfoga Solutions Pvt. Ltd.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAgreed((v) => !v)}
        className={cn(
          'flex w-full shrink-0 items-start gap-3 rounded-xl border p-4 text-left transition-all',
          agreed
            ? 'border-emerald-500/50 bg-emerald-500/10'
            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-xl border transition-all',
            agreed
              ? 'border-emerald-400 bg-emerald-500 text-black'
              : 'border-slate-600',
          )}
        >
          {agreed && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm text-slate-300">
          I have read and agree to the KYC Verification &amp; Platform Usage
          Disclaimer, and I consent to Scaninfoga verifying my identity.
        </span>
      </button>

      <motion.div className="shrink-0" whileTap={{ scale: agreed ? 0.99 : 1 }}>
        <Button
          type="button"
          disabled={!agreed}
          onClick={onAgree}
          className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-40"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Next
          <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
        </Button>
      </motion.div>
    </div>
  );
}
