'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { LocationDataType, RouteDataType } from '@/types/map';

// Satellite "profile" basemap shared by every map variant. Defined in
// ./constants so MapCanvas can use it as the default without importing this
// (heavier) module. Re-exported here for existing callers.
import { BASEMAP_TILE } from './constants';
export { BASEMAP_TILE };

/** Leaflet engine, loaded client-side only (it touches `window`). */
export const DynamicMap = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

/** Pulsing placeholder shown while the map engine streams in. */
export function MapSkeleton(): JSX.Element {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-900 via-slate-800/60 to-slate-900" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    </div>
  );
}

export type MapDimension = number | string;

/** Normalise a width/height prop into a CSS length. */
export function toCssSize(value: MapDimension | undefined, fallback: string) {
  if (value === undefined) return fallback;
  return typeof value === 'number' ? `${value}px` : value;
}

interface MapPreviewProps {
  data: RouteDataType | LocationDataType;
  width: string;
  height: string;
  onOpen: () => void;
  /** Optional content pinned to the top-left of the preview. */
  badge?: React.ReactNode;
  className?: string;
}

/**
 * Static (non-draggable) map preview that invites the user to expand. Clicking
 * anywhere — or pressing Enter/Space — opens the full explorable dialog.
 */
export function MapPreview({
  data,
  width,
  height,
  onOpen,
  badge,
  className,
}: MapPreviewProps): JSX.Element {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Open interactive map"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{ width, height }}
      className={cn(
        // `isolate` keeps Leaflet's internal z-indexes (panes/controls reach
        // ~1000) inside this stacking context so a preview can never paint over
        // the explore dialog.
        'group relative isolate cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-lg shadow-black/30 transition-colors duration-300 hover:border-emerald-500/50',
        className,
      )}
    >
      {/* The preview map is non-interactive so the whole tile acts as a button. */}
      <div className="pointer-events-none absolute inset-0">
        <DynamicMap data={data} interactive={false} tileUrl={BASEMAP_TILE} />
      </div>

      {/* Hover veil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060b17]/70 via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-60" />

      {badge ? <div className="absolute left-3 top-3 z-10">{badge}</div> : null}

      {/* Expand affordance */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-xl border border-slate-700/70 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md transition-all duration-300 group-hover:border-emerald-500/50 group-hover:text-emerald-300">
        <Maximize2 className="h-3.5 w-3.5" />
        <span>Explore</span>
      </div>
    </motion.div>
  );
}

interface ExploreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RouteDataType | LocationDataType;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Stat chips / metadata rendered in the dialog header. */
  stats?: React.ReactNode;
}

/**
 * Full-screen-ish dialog with a fully interactive (draggable / zoomable) map
 * plus a themed header. Shared by both Route and Location variants.
 */
export function ExploreDialog({
  open,
  onOpenChange,
  data,
  title,
  subtitle,
  icon,
  stats,
}: ExploreDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden border-slate-800 bg-[#060b17] p-0 sm:max-w-5xl">
        <div className="flex items-start gap-3 border-b border-slate-800 bg-slate-900/40 px-5 py-4 backdrop-blur-xl">
          {icon ? (
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pr-8">
            <DialogTitle className="break-words text-base font-bold text-white">
              {title}
            </DialogTitle>
            {subtitle ? (
              <DialogDescription className="mt-0.5 break-words text-sm text-slate-400">
                {subtitle}
              </DialogDescription>
            ) : null}
            {stats ? <div className="mt-3">{stats}</div> : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <DynamicMap data={data} interactive tileUrl={BASEMAP_TILE} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: 'emerald' | 'cyan' | 'amber';
}

/** Compact metric chip (duration, distance …). */
export function StatChip({
  icon,
  label,
  value,
  accent = 'emerald',
}: StatChipProps): JSX.Element {
  const accentMap = {
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
  } as const;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className={cn('shrink-0', accentMap[accent])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={cn(
            'whitespace-nowrap text-sm font-bold',
            accentMap[accent],
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
