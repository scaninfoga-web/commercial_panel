/**
 * Single Google-Maps-style satellite basemap used by every map variant (Route,
 * Location, address popups, …), regardless of the tile URL the payload happens
 * to ship with. Esri World Imagery base; MapCanvas stacks road + place label
 * overlays on top (the imagery tiles ship no labels).
 *
 * This is the default basemap for every map — the "profile" satellite look.
 */
export const BASEMAP_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
