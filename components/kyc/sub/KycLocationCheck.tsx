'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  MapPin,
  Navigation,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { getRouteMapData } from '@/actions/MapActions';
import RouteMapData from '@/components/common/map/RouteMapData';
import { MapSkeleton } from '@/components/common/map/mapShared';
import { formatSentence } from '@/components/custom/functions/formatUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RouteDataType } from '@/types/map';

/** A user must be within this radius of their Aadhaar address to continue. */
export const KYC_MAX_DISTANCE_METERS = 50_000;

interface KycLocationCheckProps {
  address: string | null | undefined;
  onProceed: () => void;
}

type CheckState = 'loading' | 'near' | 'far' | 'unavailable';

function km(meters: number): string {
  return (meters / 1000).toFixed(2);
}

/**
 * Compares the user's live location against their Aadhaar address via the
 * route API. Beyond 50 km the flow is blocked with the route rendered on a
 * map; within 50 km it hands off to Face Verification.
 */
export default function KycLocationCheck({
  address,
  onProceed,
}: KycLocationCheckProps): JSX.Element {
  const [route, setRoute] = useState<RouteDataType | null>(null);
  const [state, setState] = useState<CheckState>('loading');

  useEffect(() => {
    let active = true;

    const check = async () => {
      setState('loading');
      const data = await getRouteMapData(address, 'dark');
      if (!active) return;

      const meters = data?.route?.distance_meters;
      if (!data || typeof meters !== 'number') {
        setRoute(data);
        setState('unavailable');
        return;
      }
      setRoute(data);
      setState(meters > KYC_MAX_DISTANCE_METERS ? 'far' : 'near');
    };

    void check();
    return () => {
      active = false;
    };
  }, [address]);

  const meters = route?.route?.distance_meters ?? 0;

  if (state === 'loading') {
    return (
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Navigation className="h-4 w-4 animate-pulse text-emerald-400" />
          Matching your current location with your Aadhaar address…
        </div>
        <div className="h-40 overflow-hidden rounded-xl border border-slate-800">
          <MapSkeleton />
        </div>
      </div>
    );
  }

  if (state === 'far') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <div className="overflow-hidden rounded-xl border border-red-500/40 bg-red-500/5">
          <div className="flex items-start gap-3 border-b border-red-500/20 bg-red-500/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-red-300">
                Cannot proceed with your KYC
              </h4>
              <p className="mt-1 break-words text-sm text-slate-300">
                Your current location does not match your Aadhaar address. You
                must be physically present within{' '}
                <span className="font-semibold text-red-300">50 km</span> of
                your registered address to complete verification.
              </p>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-red-500/30 bg-slate-950/50 p-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <Navigation className="h-3.5 w-3.5 text-red-400" />
                Distance
              </p>
              <p className="mt-1 text-lg font-bold text-red-400">
                {km(meters)} km
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Allowed radius
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-400">
                50.00 km
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                Travel time
              </p>
              <p className="mt-1 text-lg font-bold text-cyan-400">
                {formatSentence(route?.route?.duration_text)}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4">
            {route && <RouteMapData data={route} size="big" height={260} />}
          </div>
        </div>

        <Button
          type="button"
          disabled
          className="w-full bg-slate-800 font-semibold text-slate-500"
        >
          <ScanFace className="mr-2 h-4 w-4" />
          Face Verification locked
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border p-3 text-sm',
          state === 'near' &&
            'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
          state === 'unavailable' &&
            'border-slate-800 bg-slate-950/60 text-slate-400',
        )}
      >
        {state === 'near' ? (
          <>
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Location verified — you are {km(meters)} km from your Aadhaar
            address.
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 shrink-0" />
            Location could not be matched right now. You may continue with face
            verification.
          </>
        )}
      </div>

      <Button
        type="button"
        onClick={onProceed}
        className="group w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
      >
        <ScanFace className="mr-2 h-4 w-4" />
        Next: Face Verification
        <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
      </Button>
    </motion.div>
  );
}
