interface Marker {
  lat: number;
  lng: number;
  type: string;
  label: string;
}
interface LatLong {
  lat: number;
  lng: number;
}
interface Bounds {
  south_west: LatLong;
  north_east: LatLong;
}
type Coordinate = [number, number];

export type MapTheme = 'dark' | 'light';

export interface LocationDataType {
  type: string;
  theme: MapTheme;
  tile_url: string;
  attribution: string;
  center: LatLong;
  zoom: number;
  bounds: Bounds;
  markers: Marker[];
}

export interface RouteDataType {
  type: string;
  theme: MapTheme;
  tile_url: string;
  attribution: string;
  center: LatLong;
  route: {
    color: string;
    coordinates: Coordinate[];
    distance_text: string;
    duration_text: string;
    distance_meters: number;
    duration_seconds: number;
  };
  bounds: Bounds;
  markers: Marker[];
}
