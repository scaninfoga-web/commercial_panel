'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KYC_FALLBACK_ROUTE, useKycGate } from '@/hooks/useKycGate';
import AadhaarKycDialog from './AadhaarKycDialog';
import KycCompletedDialog from './KycCompletedDialog';
import VideoKycDialog from './VideoKycDialog';
import KycLockedPanel from './sub/KycLockedPanel';

interface KycGateProps {
  children: React.ReactNode;
}

/**
 * Wraps the sidebar pages: on a KYC-gated route a user who has not cleared
 * BOTH Aadhaar and video KYC never gets the page content — it is replaced by a
 * locked panel with the mandatory flow on top, which cannot be dismissed.
 *
 * The two stages run in order: Aadhaar first (it produces the UIDAI photo),
 * then the video liveness check that matches against it.
 */
export default function KycGate({ children }: KycGateProps): JSX.Element {
  const router = useRouter();
  const {
    stage,
    greeting,
    videoKycPending,
    advance,
    complete,
    celebration,
    dismissCelebration,
  } = useKycGate();

  const leave = useCallback(() => {
    router.push(KYC_FALLBACK_ROUTE);
  }, [router]);

  // Nothing to gate — but the user may have just landed back from a passed
  // video KYC, which gets its own (dismissable) congratulations dialog.
  if (stage === 'none') {
    return (
      <>
        {children}
        {celebration && (
          <KycCompletedDialog
            open
            profileImage={celebration.profileImage}
            onClose={dismissCelebration}
          />
        )}
      </>
    );
  }

  return (
    <>
      <KycLockedPanel stage={stage} />

      {stage === 'aadhaar' && (
        <AadhaarKycDialog
          open
          greeting={greeting}
          videoKycPending={videoKycPending}
          onLeave={leave}
          onComplete={advance}
        />
      )}

      {stage === 'video' && (
        <VideoKycDialog open greeting={greeting} onLeave={leave} />
      )}
    </>
  );
}
