'use client';

import React, { useState } from 'react';
import { Clock, MapPin, Navigation, Route as RouteIcon } from 'lucide-react';

import { formatSentence } from '@/components/custom/functions/formatUtils';
import { cn } from '@/lib/utils';
import type { RouteDataType } from '@/types/map';

import {
  ExploreDialog,
  MapPreview,
  StatChip,
  toCssSize,
  type MapDimension,
} from './mapShared';

interface RouteMapDataProps {
  data: RouteDataType;
  /** `small` → map-only preview that opens a dialog. `big` → detail card. */
  size?: 'small' | 'big';
  /** Map dimensions. Default small: 100% × 220px, big: 100% × 320px. */
  width?: MapDimension;
  height?: MapDimension;
  className?: string;
}

/** Pull the human destination address out of the markers, if present. */
function destinationLabel(data: RouteDataType): string {
  const dest = data.markers?.find((m) => m.type === 'destination');
  return dest?.label ?? '';
}

function km(meters: number): string {
  return (meters / 1000).toFixed(3);
}

/**
 * Renders a route (origin → destination polyline) on a Leaflet map.
 *
 * - `small`: a compact, static preview. Click to open a fully draggable /
 *   zoomable map in a dialog.
 * - `big`: a detail card showing the address, duration and distance beside an
 *   explorable map preview.
 */
export default function RouteMapData({
  data,
  size = 'big',
  width,
  height,
  className,
}: RouteMapDataProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const address = destinationLabel(data);
  const distanceKm = data.route?.distance_meters
    ? km(data.route.distance_meters)
    : '----';

  const dialogStats = (
    <div className="flex flex-wrap gap-2">
      <StatChip
        icon={<Clock className="h-4 w-4" />}
        label="Total Duration"
        value={formatSentence(data.route?.duration_text)}
      />
      <StatChip
        icon={<RouteIcon className="h-4 w-4" />}
        label="Distance"
        value={formatSentence(data.route?.distance_text)}
        accent="cyan"
      />
      <StatChip
        icon={<Navigation className="h-4 w-4" />}
        label="Distance (km)"
        value={distanceKm}
        accent="amber"
      />
    </div>
  );

  const dialog = (
    <ExploreDialog
      open={open}
      onOpenChange={setOpen}
      data={data}
      icon={<RouteIcon className="h-5 w-5" />}
      title={formatSentence(address)}
      subtitle="Route overview — drag, scroll and zoom to explore"
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
              <RouteIcon className="h-3.5 w-3.5" />
              {formatSentence(data.route?.distance_text)}
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

          <div className="mt-6 flex flex-wrap gap-3">
            <StatChip
              icon={<Clock className="h-4 w-4" />}
              label="Total Duration"
              value={formatSentence(data.route?.duration_text)}
            />
            <StatChip
              icon={<RouteIcon className="h-4 w-4" />}
              label="Distance"
              value={formatSentence(data.route?.distance_text)}
              accent="cyan"
            />
            <StatChip
              icon={<Navigation className="h-4 w-4" />}
              label="Distance (km)"
              value={distanceKm}
              accent="amber"
            />
          </div>

          <p className="mt-auto pt-6 text-xs text-slate-500">
            Tap the map to drag, zoom and explore the full route.
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
