'use client';

import { Lock, ShieldAlert } from 'lucide-react';
import type { KycStage } from '@/hooks/useKycGate';

interface KycLockedPanelProps {
  stage: KycStage;
}

const COPY: Record<Exclude<KycStage, 'none'>, string> = {
  aadhaar:
    'Aadhaar KYC verification is required before you can access intelligence modules. Complete the verification to unlock this page.',
  video:
    'One step left. A quick video verification confirms it is really you before intelligence modules unlock.',
};

/** What a gated route shows in place of its content while KYC is pending. */
export default function KycLockedPanel({
  stage,
}: KycLockedPanelProps): JSX.Element {
  return (
    <section className="relative z-10 mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-xl bg-amber-500/20 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Lock className="h-7 w-7 text-amber-400" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-white md:text-2xl">
        This module is locked
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        {stage === 'none' ? COPY.aadhaar : COPY[stage]}
      </p>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2.5 text-xs text-slate-400 backdrop-blur-xl">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        {stage === 'video'
          ? 'Video verification pending'
          : 'Verification pending'}
      </div>
    </section>
  );
}
