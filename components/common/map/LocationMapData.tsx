'use client';

import React, { useState } from 'react';
import { Crosshair, MapPin, Navigation2 } from 'lucide-react';

import { formatSentence } from '@/components/custom/functions/formatUtils';
import { cn } from '@/lib/utils';
import type { LocationDataType } from '@/types/map';

import {
  ExploreDialog,
  MapPreview,
  StatChip,
  toCssSize,
  type MapDimension,
} from './mapShared';

interface LocationMapDataProps {
  data: LocationDataType;
  /** `small` → map-only preview that opens a dialog. `big` → detail card. */
  size?: 'small' | 'big';
  /** Map dimensions. Default small: 100% × 220px, big: 100% × 320px. */
  width?: MapDimension;
  height?: MapDimension;
  className?: string;
}

/** Primary marker label is treated as the location's address. */
function locationLabel(data: LocationDataType): string {
  return data.markers?.[0]?.label ?? '';
}

/**
 * Renders a single pinned location on a Leaflet map.
 *
 * - `small`: a compact, static preview. Click to open a fully draggable /
 *   zoomable map in a dialog.
 * - `big`: a detail card showing the address and coordinates beside an
 *   explorable map preview.
 */
export default function LocationMapData({
  data,
  size = 'big',
  width,
  height,
  className,
}: LocationMapDataProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const address = locationLabel(data);
  const lat = formatSentence(data.center?.lat);
  const lng = formatSentence(data.center?.lng);

  const dialogStats = (
    <div className="flex flex-wrap gap-2">
      <StatChip
        icon={<Crosshair className="h-4 w-4" />}
        label="Latitude"
        value={lat}
      />
      <StatChip
        icon={<Crosshair className="h-4 w-4" />}
        label="Longitude"
        value={lng}
        accent="cyan"
      />
    </div>
  );

  const dialog = (
    <ExploreDialog
      open={open}
      onOpenChange={setOpen}
      data={data}
      icon={<MapPin className="h-5 w-5" />}
      title={formatSentence(address)}
      subtitle="Location — drag, scroll and zoom to explore"
      stats={dialogStats}
    />
  );

  // ---- small: preview only --------------------------------------------------
  if (size === 'small') {
    return (
      <>
        <MapPreview
          data={data}
          width={toCssSize(width, '100%')}
          height={toCssSize(height, '220px')}
          onOpen={() => setOpen(true)}
          className={className}
          badge={
            <span className="flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5" />
              Location
            </span>
          }
        />
        {dialog}
      </>
    );
  }

  // ---- big: detail card -----------------------------------------------------
  return (
    <>
      <div
        className={cn(
          'grid grid-cols-1 gap-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-xl lg:grid-cols-2 lg:p-6',
          className,
        )}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <MapPin className="h-4 w-4 text-emerald-400" />
            Full Address
          </div>
          <h3 className="mt-2 break-words text-lg font-bold leading-snug text-white">
            {formatSentence(address)}
          </h3>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatChip
              icon={<Crosshair className="h-4 w-4" />}
              label="Latitude"
              value={lat}
            />
            <StatChip
              icon={<Navigation2 className="h-4 w-4" />}
              label="Longitude"
              value={lng}
              accent="cyan"
            />
          </div>

          <p className="mt-auto pt-6 text-xs text-slate-500">
            Tap the map to drag, zoom and explore the location.
          </p>
        </div>

        <MapPreview
          data={data}
          width={toCssSize(width, '100%')}
          height={toCssSize(height, '320px')}
          onOpen={() => setOpen(true)}
        />
      </div>
      {dialog}
    </>
  );
}
