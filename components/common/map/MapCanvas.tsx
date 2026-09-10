'use client';

import React, { useEffect, useRef } from 'react';
import type {
  Map as LeafletMap,
  LatLngBoundsExpression,
  LatLngExpression,
} from 'leaflet';

import 'leaflet/dist/leaflet.css';

import type { LocationDataType, RouteDataType } from '@/types/map';
import { BASEMAP_TILE } from './constants';

type MarkerKind = 'origin' | 'destination' | 'location' | string;

interface MapCanvasProps {
  /** Either a route payload or a location payload. */
  data: RouteDataType | LocationDataType;
  /** When false the map is a static preview (no drag / zoom / scroll). */
  interactive?: boolean;
  /** Override the payload tile URL (e.g. to compare basemap styles). */
  tileUrl?: string;
  className?: string;
}

/**
 * Build a Google-Maps-style marker for a given kind:
 * - `origin` → the blue "your location" dot (white ring + blue core + halo).
 * - everything else (destination / location) → a red teardrop pin whose tip
 *   sits exactly on the coordinate.
 */
function buildIcon(
  L: typeof import('leaflet'),
  kind: MarkerKind,
): import('leaflet').DivIcon {
  if (kind === 'origin') {
    return L.divIcon({
      className: 'siq-pin',
      html: `
        <span class="siq-dot">
          <span class="siq-dot__halo"></span>
          <span class="siq-dot__core"></span>
        </span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14],
    });
  }

  return L.divIcon({
    className: 'siq-pin',
    html: `
      <span class="siq-drop">
        <svg viewBox="0 0 24 36" width="21" height="32" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 24 12 24s12-15.5 12-24C24 5.37 18.63 0 12 0z" fill="#EA4335"/>
          <circle cx="12" cy="12" r="5.2" fill="#B31412"/>
        </svg>
      </span>`,
    iconSize: [21, 32],
    iconAnchor: [10.5, 32],
    popupAnchor: [0, -28],
  });
}

/**
 * Vanilla-Leaflet engine shared by every map variant. Rendered client-side
 * only (Leaflet touches `window`). Draws tiles, markers and an optional route
 * polyline, then fits the viewport to the supplied bounds.
 */
export default function MapCanvas({
  data,
  interactive = true,
  tileUrl,
  className,
}: MapCanvasProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const el = containerRef.current;
    if (!el) return;

    // Leaflet is imported lazily so it never runs during SSR.
    import('leaflet').then((L) => {
      const node = containerRef.current;
      if (cancelled || !node) return;

      // Guard against React re-running the effect (HMR / fast refresh) on a
      // container Leaflet already claimed → avoids "Map container is already
      // initialized."
      if ((node as unknown as { _leaflet_id?: number })._leaflet_id != null) {
        return;
      }

      const map = L.map(node, {
        maxZoom: 22,
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
        attributionControl: false,
        fadeAnimation: true,
        zoomAnimation: true,
      });
      mapRef.current = map;

      // CARTO's dark basemap bakes its labels straight into the tile and they
      // render too dim to read. Split it into a no-label base + a separate
      // label-only overlay, then brighten just the labels in CSS (see
      // `.siq-tiles-labels` in globals.css). Non-CARTO tiles render as-is.
      // Default every map to the satellite "profile" basemap. Callers can still
      // override via `tileUrl`; the payload's own `data.tile_url` (often CARTO
      // dark) is only a last-resort fallback.
      const baseUrl = tileUrl ?? BASEMAP_TILE ?? data.tile_url;
      const isCartoDark = baseUrl.includes('dark_all');
      // Esri World Imagery = the Google-satellite "light" theme. The imagery
      // tiles ship no labels, so we stack Esri's road + place reference layers
      // on top to recreate the labelled satellite look.
      const isEsriSat = baseUrl.includes('World_Imagery');

      // `maxNativeZoom` caps where real tiles exist; Leaflet upscales beyond it
      // up to `maxZoom`, so users can keep zooming in past the imagery's native
      // resolution instead of hitting a hard wall. `detectRetina` is left OFF on
      // purpose: on hi-dpi screens it fetches tiles one zoom level deeper than
      // displayed, which pushes Esri past z19 and returns opaque "Map data not
      // yet available" placeholder tiles. Upscaling the native tile is reliable.
      L.tileLayer(
        isCartoDark ? baseUrl.replace('dark_all', 'dark_nolabels') : baseUrl,
        {
          maxZoom: 22,
          maxNativeZoom: 19,
        },
      ).addTo(map);

      if (isCartoDark) {
        L.tileLayer(baseUrl.replace('dark_all', 'dark_only_labels'), {
          maxZoom: 22,
          maxNativeZoom: 19,
          className: 'siq-tiles-labels',
        }).addTo(map);
      }

      if (isEsriSat) {
        // Roads + boundaries/place labels, drawn over the imagery.
        [
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        ].forEach((url) =>
          L.tileLayer(url, {
            maxZoom: 22,
            maxNativeZoom: 19,
          }).addTo(map),
        );
      }

      // --- markers ---------------------------------------------------------
      data.markers?.forEach((m) => {
        const icon = buildIcon(L, m.type);
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        // Only bind popups on the real, interactive map. Previews are
        // pointer-events:none, so a popup there can only be visual noise.
        if (interactive && m.label) {
          marker.bindPopup(`<div class="siq-popup">${m.label}</div>`, {
            closeButton: false,
          });
        }
      });

      // --- route polyline --------------------------------------------------
      if ('route' in data && data.route?.coordinates?.length) {
        const latlngs = data.route.coordinates as LatLngExpression[];
        // Always render the route in the brand emerald (ignore payload colour).
        const routeColor = '#10b981';
        // Soft glow underlay + crisp top line.
        L.polyline(latlngs, {
          color: routeColor,
          weight: 9,
          opacity: 0.25,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        L.polyline(latlngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
      }

      // --- viewport --------------------------------------------------------
      const b = data.bounds;
      const sameCorner =
        b &&
        b.south_west.lat === b.north_east.lat &&
        b.south_west.lng === b.north_east.lng;
      const fallbackZoom =
        'zoom' in data && typeof data.zoom === 'number' ? data.zoom : 15;

      const applyView = () => {
        if (b && !sameCorner) {
          const bounds: LatLngBoundsExpression = [
            [b.south_west.lat, b.south_west.lng],
            [b.north_east.lat, b.north_east.lng],
          ];
          map.fitBounds(bounds, { padding: [36, 36] });
        } else {
          map.setView([data.center.lat, data.center.lng], fallbackZoom);
        }
      };

      // Set a view immediately so the tile layer always has a center/zoom to
      // fetch from. The ResizeObserver fit below refines this once the
      // container reports a real size — but a fixed-size preview (e.g. the
      // inline address map) may never change size, so its observer can fire
      // before layout reports non-zero dimensions and the refined fit is
      // skipped. Without an eager view the map stays view-less, computes no
      // tiles, and renders as an empty (gray) container.
      map.setView([data.center.lat, data.center.lng], fallbackZoom);

      // The container can still be 0×0 at init (inside a flex row or a dialog
      // mid open-animation). Fitting then would zoom out to the whole world, so
      // we wait for a real size before fitting, and only fit once. Later resizes
      // just recalc the tile grid without snapping the user's zoom back.
      let didFit = false;
      const onResize = () => {
        const m = mapRef.current;
        if (cancelled || !m || !node.offsetWidth || !node.offsetHeight) return;
        m.invalidateSize();
        if (!didFit) {
          didFit = true;
          applyView();
        }
      };

      observer = new ResizeObserver(onResize);
      observer.observe(node);
      onResize();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      const map = mapRef.current;
      if (map) {
        // A zoom animation in flight schedules `setTimeout(_onZoomTransitionEnd,
        // 250)` (Leaflet's webkit `transitionend` fallback) that `remove()` never
        // cancels. After remove() deletes `_mapPane`, that stale callback fires,
        // and because `_animatingZoom` is still true it slips past its early-out
        // and calls `_move` → reads `_mapPane._leaflet_pos` on undefined → throws
        // async (so the try/catch below can't catch it). Clearing the flag makes
        // the stale callback no-op.
        (map as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
        // Never let teardown throw — an error during React's commit leaves Radix
        // dialogs with `pointer-events: none` on <body>, freezing the page.
        try {
          map.remove();
        } catch {
          // map already gone / never finished initialising
        }
      }
      mapRef.current = null;
    };
  }, [data, interactive, tileUrl]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: '100%', width: '100%', background: '#0b1220' }}
    />
  );
}
