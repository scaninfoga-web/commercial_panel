'use client';

import { useEffect, useState } from 'react';
import {
  MapPin,
  Globe,
  Smartphone,
  Monitor,
  Wifi,
  Navigation,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { motion } from 'framer-motion';
import { getLocationMapData } from '@/actions/MapActions';
import LocationMapData from '@/components/common/map/LocationMapData';
import { MapSkeleton } from '@/components/common/map/mapShared';
import type { LocationDataType } from '@/types/map';

/** Resolved maps keyed by "lat,lng" so re-mounts don't refetch. */
const locationCache = new Map<string, LocationDataType>();

const InfoItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number | null | undefined;
}) => (
  <div className="flex flex-col gap-1 rounded-xl border border-slate-800/50 bg-slate-900/30 px-2.5 py-2 transition-all duration-300 hover:border-emerald-500/30 hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2.5">
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 sm:h-7 sm:w-7">
        <Icon className="h-3 w-3 text-slate-400 sm:h-3.5 sm:w-3.5" />
      </div>
      <span className="text-[10px] text-slate-400 sm:text-xs">{label}</span>
    </div>
    <span className="break-all text-xs font-medium text-white sm:text-sm">
      {value ?? '-'}
    </span>
  </div>
);

export const LocationOverviewCard = () => {
  const info = useSelector((state: RootState) => state.info);
  const [locationData, setLocationData] = useState<LocationDataType | null>(
    null,
  );
  const [mapLoading, setMapLoading] = useState(false);

  const latitude = Number(info.latitude);
  const longitude = Number(info.longitude);

  useEffect(() => {
    if (!latitude || !longitude) return;

    const key = `${latitude},${longitude}`;
    const cached = locationCache.get(key);
    if (cached) {
      setLocationData(cached);
      return;
    }

    let cancelled = false;
    setMapLoading(true);
    getLocationMapData(latitude, longitude, 'dark')
      .then((res) => {
        if (cancelled || !res) return;
        locationCache.set(key, res);
        setLocationData(res);
      })
      .finally(() => {
        if (!cancelled) setMapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return (
    <Card className="h-full rounded-xl border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-sm text-emerald-400 sm:text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-8 sm:w-8">
            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          Location Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">
        {/* Location Info Grid */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <InfoItem icon={Navigation} label="Latitude" value={info.latitude} />
          <InfoItem
            icon={Navigation}
            label="Longitude"
            value={info.longitude}
          />
          <InfoItem icon={Smartphone} label="Device" value={info.device} />
          <InfoItem icon={Monitor} label="Browser" value={info.browser} />
          <div className="col-span-2">
            <InfoItem icon={Wifi} label="IP Address" value={info.ip} />
          </div>
        </div>

        {/* Map Display */}
        {locationData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <LocationMapData data={locationData} size="small" height={380} />
          </motion.div>
        ) : mapLoading ? (
          <div className="h-[380px] overflow-hidden rounded-xl border border-slate-800">
            <MapSkeleton />
          </div>
        ) : (
          <div className="flex h-[380px] flex-col items-center justify-center rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 text-center">
            <motion.div
              className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-500/10"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Globe className="h-8 w-8 text-emerald-400" />
            </motion.div>
            <p className="text-sm font-medium text-slate-300 sm:text-base">
              Interactive Map
            </p>
            <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">
              Map visualization will be displayed here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
