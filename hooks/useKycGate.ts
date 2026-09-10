'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearVideoKycReturn,
  readVideoKycReturn,
  type VideoKycReturn,
} from '@/lib/videoKyc';
import { setVideoKycVerified } from '@/redux/userSlice';
import type { RootState } from '@/redux/store';

/** Routes that stay locked until the signed-in user finishes both KYC stages. */
export const KYC_GATED_ROUTES = [
  '/digitalIntelligence',
  '/scaninfogaIntelligence',
] as const;

/** Where a blocked user is sent when they back out of the flow. */
export const KYC_FALLBACK_ROUTE = '/dashboard';

/**
 * Which stage of the mandatory flow is on screen. `'none'` means the route is
 * open — either it was never gated, or both stages are done.
 */
export type KycStage = 'none' | 'aadhaar' | 'video';

/** First word of the name — "Ashish Tiwari" → "Ashish". */
export function firstName(name: string | undefined | null): string {
  return (name || '').trim().split(/\s+/)[0] || 'User';
}

/** Gendered honorific; falls back to both when gender is unknown. */
export function honorific(gender: string | null | undefined): string {
  const g = String(gender || '').toUpperCase();
  if (g === 'MALE') return 'Sir';
  if (g === 'FEMALE') return "Ma'am";
  return "Sir/Ma'am";
}

interface KycGate {
  /**
   * The stage to render. While it is not `'none'` the route must stay locked
   * and the page content must not render.
   */
  stage: KycStage;
  /** "Dear Ashish Sir" */
  greeting: string;
  /** True while the video stage is still outstanding — drives Aadhaar copy. */
  videoKycPending: boolean;
  /** Aadhaar finished: move to video KYC, or release the lock if it is done. */
  advance: () => void;
  /** Called once the whole flow is finished; releases the lock. */
  complete: () => void;
  /** Set when the user just landed back from a passed video KYC. */
  celebration: VideoKycReturn | null;
  dismissCelebration: () => void;
}

/**
 * Reads the "just came back from the liveness worker" params exactly once per
 * mount, during render rather than in an effect. An effect would run a frame
 * too late: the gate would already have committed `stage: 'video'` and, being
 * sticky, would keep the dialog on screen for a user who just passed it.
 *
 * The read is pure — stripping the params happens in an effect below, because
 * `history.replaceState` is patched by the App Router and updating router state
 * mid-render throws. A ref (unlike a lazy `useState`) is not re-evaluated by
 * StrictMode's double render, so the URL is read once and only once.
 */
function useVideoKycReturn(): VideoKycReturn {
  const returned = useRef<VideoKycReturn | null>(null);
  if (returned.current === null) returned.current = readVideoKycReturn();
  return returned.current;
}

/**
 * Locks `/digitalIntelligence` and `/scaninfogaIntelligence` until the user
 * has cleared BOTH Aadhaar KYC and video (face-match + liveness) KYC. Aadhaar
 * always comes first — the video stage matches the live capture against the
 * UIDAI photo that Aadhaar KYC produces, so it cannot run without it.
 *
 * There is no dismiss — the lock lifts only when both stages complete or the
 * user leaves for an ungated route.
 */
export function useKycGate(): KycGate {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.user.user);
  const videoKycReturn = useVideoKycReturn();

  const [stage, setStage] = useState<KycStage>('none');
  const [completed, setCompleted] = useState(false);
  const [celebrating, setCelebrating] = useState(videoKycReturn.done);

  const gated = KYC_GATED_ROUTES.some((route) => pathname?.startsWith(route));
  const needsAadhaar = !!user && !user.is_aadhaar_kyc;
  const needsVideo = !!user && !user.is_video_kyc && !videoKycReturn.done;

  // The worker only redirects back once the main backend has accepted the
  // report, so the flag is enough to mirror the flip locally. Clearing the URL
  // here (not during render) keeps a reload from replaying the celebration.
  useEffect(() => {
    if (!videoKycReturn.done) return;
    clearVideoKycReturn();
    dispatch(
      setVideoKycVerified({
        verified: true,
        profileImage: videoKycReturn.profileImage,
      }),
    );
  }, [videoKycReturn.done, videoKycReturn.profileImage, dispatch]);

  useEffect(() => {
    if (completed || !gated) {
      setStage('none');
      return;
    }
    setStage((prev) => {
      // Sticky once the flow is up: verification flips `is_aadhaar_kyc` to
      // true the moment the OTP validates, and the success screen has to
      // survive that update. Only `advance` / `complete` move it from here.
      if (prev !== 'none') return prev;
      if (needsAadhaar) return 'aadhaar';
      if (needsVideo) return 'video';
      return 'none';
    });
  }, [completed, gated, needsAadhaar, needsVideo, pathname]);

  const complete = useCallback(() => {
    setCompleted(true);
    setStage('none');
  }, []);

  const advance = useCallback(() => {
    if (needsVideo) {
      setStage('video');
      return;
    }
    complete();
  }, [needsVideo, complete]);

  const dismissCelebration = useCallback(() => setCelebrating(false), []);

  return {
    stage,
    greeting: `Dear ${firstName(user?.name)} ${honorific(user?.gender)}`,
    videoKycPending: needsVideo,
    advance,
    complete,
    celebration: celebrating ? videoKycReturn : null,
    dismissCelebration,
  };
}
