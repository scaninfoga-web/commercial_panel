'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Info,
  MapPin,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import { getLocationMapData } from '@/actions/MapActions';
import LocationMapData from '@/components/common/map/LocationMapData';
import { MapSkeleton } from '@/components/common/map/mapShared';
import { formatSentence } from '@/components/custom/functions/formatUtils';
import { Button } from '@/components/ui/button';
import { getClientInfo } from '@/lib/header';
import type { LocationDataType } from '@/types/map';

/**
 * A distance rejection carries its numbers only inside the message, e.g.
 * "…you are 284.40 km away, the limit is 50 km". Both are optional — the
 * message is always shown, the chips only when they can be read out of it.
 */
export interface KycRejection {
  message: string;
  distanceKm: number | null;
  limitKm: number | null;
}

/** Pulls the distance figures out of a rejection message. */
export function parseRejection(message: string): KycRejection {
  return {
    message,
    distanceKm: Number(message.match(/([\d.]+)\s*km away/i)?.[1]) || null,
    limitKm: Number(message.match(/limit is\s*([\d.]+)\s*km/i)?.[1]) || null,
  };
}

/** True when the backend refused the KYC over the distance rule. */
export function isDistanceRejection(message: string): boolean {
  return /too far|km away/i.test(message);
}

interface KycRejectedNoticeProps {
  rejection: KycRejection;
}

/**
 * The blocked state inside the KYC dialog: why the backend refused, plus a map
 * of where the user currently is so the distance is something they can see.
 */
export default function KycRejectedNotice({
  rejection,
}: KycRejectedNoticeProps): JSX.Element {
  const [location, setLocation] = useState<LocationDataType | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  /** The primary marker's label is the reverse-geocoded address. */
  const address = location?.markers?.[0]?.label;

  useEffect(() => {
    let active = true;

    const loadMap = async () => {
      const { latitude, longitude } = await getClientInfo();
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!active) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setMapLoading(false);
        return;
      }
      // Server action — returns null on failure rather than throwing.
      const data = await getLocationMapData(lat, lng, 'dark');
      if (!active) return;
      setLocation(data);
      setMapLoading(false);
    };

    void loadMap();
    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-red-300">
              You cannot continue with this KYC
            </h4>
            <p className="mt-1 break-words text-sm leading-relaxed text-slate-300">
              {rejection.message}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* `content-start` keeps the chips their natural height instead of
            stretching them to match the map column. */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 md:content-start">
          <div className="rounded-xl border border-red-500/30 bg-slate-950/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Navigation className="h-3.5 w-3.5 shrink-0 text-red-400" />
              Your distance
            </p>
            <p className="mt-1 text-lg font-bold text-red-400">
              {rejection.distanceKm
                ? `${rejection.distanceKm.toFixed(2)} km`
                : 'Out of range'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Allowed radius
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-400">
              {rejection.limitKm
                ? `${rejection.limitKm.toFixed(2)} km`
                : '----'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            Your current location
          </p>
          {mapLoading ? (
            <div className="h-[170px] overflow-hidden rounded-xl border border-slate-800">
              <MapSkeleton />
            </div>
          ) : location ? (
            <>
              {/* `size="small"` on purpose: the `big` card is a two-column
                  layout that only unstacks at `lg`, so its address block and
                  map collide at any dialog width. The preview opens the full
                  interactive map on tap. */}
              <LocationMapData data={location} size="small" height={170} />
              {address && (
                <p className="break-words text-xs leading-relaxed text-slate-400">
                  {formatSentence(address)}
                </p>
              )}
            </>
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
              Your location could not be mapped. Allow location access and retry
              from within range of your Aadhaar address.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm leading-relaxed text-slate-300">
          Move within{' '}
          <span className="font-semibold text-amber-300">50 km</span> of your
          Aadhaar address before you continue. You get a maximum of{' '}
          <span className="font-semibold text-amber-300">3 attempts a day</span>{' '}
          to complete your KYC, so try again only once you are close enough.
        </p>
      </div>
    </motion.div>
  );
}
