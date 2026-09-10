import { post } from '@/lib/api';
import { getClientInfo } from '@/lib/header';
import { LocationDataType, MapTheme, RouteDataType } from '@/types/map';

export async function getRouteMapData(
  full_address: string | null | undefined,
  theme: MapTheme = 'dark',
): Promise<RouteDataType | null> {
  if (!full_address || full_address.trim().length < 5) return null;
  try {
    const { latitude, longitude } = await getClientInfo();
    if (!latitude || !longitude) return null;
    const data = await post('/api/v1/map/route-data', {
      latitude: Number(latitude),
      longitude: Number(longitude),
      full_address,
      theme,
    });
    if (data?.responseStatus?.status && data?.responseData) {
      return data.responseData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching route map data', error);
    return null;
  }
}

export async function getLocationMapData(
  latitude: number,
  longitude: number,
  theme: MapTheme = 'dark',
): Promise<LocationDataType | null> {
  if (!latitude || !longitude) return null;
  try {
    const data = await post('/api/v1/map/location-data', {
      latitude,
      longitude,
      theme,
    });
    if (data?.responseStatus?.status && data?.responseData) {
      return data.responseData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching location map data', error);
    return null;
  }
}