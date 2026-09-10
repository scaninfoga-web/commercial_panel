'use client';

import axios from 'axios';

const SESSION_KEY = 'client_info_v2';
const NA = 'N/A';

export type ClientPage =
  | 'DigitalIntelligence'
  | '365Intelligence'
  | 'Auth'
  | 'Bulk Verifications';

// Maps a route path → backend `page` enum. Keep in sync with the middleware
// schema (client_info_schema.page) in the backend header middleware.
const PAGE_BY_PATH: Record<string, ClientPage> = {
  '/scaninfogaIntelligence': '365Intelligence',
  '/digitalIntelligence': 'DigitalIntelligence',
  '/auth': 'Auth',
  '/bulkVerifications': 'Bulk Verifications',
};

// Reads the current route (client-side only) and maps it to the backend page.
// Returns undefined for any path not in the map — the backend treats page as
// optional for non-required tiers, so undefined is safe.
function getCurrentPage(): ClientPage | undefined {
  if (typeof window === 'undefined') return undefined;
  return PAGE_BY_PATH[window.location.pathname] ?? 'Auth';
}

export interface ClientInfo {
  page?: ClientPage;
  latitude: string;
  longitude: string;
  ip: string;
  browser: string;
  device: string;
  userAgent: string;
  platform: string;
  language: string;
  cookiesEnabled: boolean;
  javascriptEnabled: boolean;
  touchSupport: boolean;
  deviceType: string;
  cpuCores: string;
  memory: string;
  screenSize: string;
  batteryLevel: string;
  isCharging: string;
  gpuRenderer: string;
  cameras: string;
  microphones: string;
  publicIp: string;
  isp: string;
  asn: string;
  city: string;
  country: string;
  possibleIoT: boolean;
}

// ─── Collectors ───────────────────────────────────────────────────────────────

function getBrowser(): string {
  const ua = navigator.userAgent || '';
  const nav = navigator as any;

  try {
    if (nav.userAgentData?.brands?.length) {
      const brands = nav.userAgentData.brands
        .map((b: any) => b.brand)
        .join(',');
      if (/Brave/i.test(brands)) return 'Brave';
      if (/Microsoft Edge|Edge/i.test(brands)) return 'Edge';
      if (/Opera/i.test(brands)) return 'Opera';
      if (/Vivaldi/i.test(brands)) return 'Vivaldi';
      if (/Chromium|Google Chrome/i.test(brands)) return 'Chrome';
    }
  } catch {}

  if ((nav as any).brave?.isBrave) return 'Brave';
  if (/FxiOS|Firefox/i.test(ua)) return 'Firefox';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Browser';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Vivaldi/i.test(ua)) return 'Vivaldi';
  if (/UCBrowser/i.test(ua)) return 'UC Browser';
  if (/YaBrowser/i.test(ua)) return 'Yandex';
  if (/DuckDuckGo/i.test(ua)) return 'DuckDuckGo';
  if (/CriOS|Chrome|Chromium/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';

  return 'Other Browser';
}

function getDevice(): string {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints || 0;

  if (/iPhone|iPod/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1))
    return 'iPad';
  if (/Android/i.test(ua))
    return /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet';
  if (/Windows Phone/i.test(ua)) return 'Windows Phone';
  if (/Windows|Win16|Win32|Win64/i.test(ua + platform)) return 'Windows PC';
  if (/Macintosh|MacIntel|MacPPC|Mac68K|Mac/i.test(ua + platform)) return 'Mac';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  if (/Linux/i.test(ua + platform)) return 'Linux PC';
  if (/SmartTV|TV/i.test(ua)) return 'Smart TV';

  return 'Generic Device';
}

function getDeviceType(): string {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouch = navigator.maxTouchPoints || 0;

  if (/Mobi|Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua))
    return 'mobile';
  if (/Tablet|iPad/i.test(ua) || (platform === 'MacIntel' && maxTouch > 1))
    return 'tablet';
  return 'desktop';
}

function getGpuRenderer(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return 'Software Renderer';

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (renderer) return String(renderer);
    }

    const fallback = gl.getParameter(gl.RENDERER);
    if (fallback) return String(fallback);
    return 'Software Renderer';
  } catch {
    return 'Software Renderer';
  }
}

async function getBatteryInfo(): Promise<{
  level: string;
  charging: string;
}> {
  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      const battery = await nav.getBattery();
      return {
        level:
          typeof battery.level === 'number'
            ? `${Math.round(battery.level * 100)}%`
            : '100%',
        charging:
          typeof battery.charging === 'boolean'
            ? String(battery.charging)
            : 'true',
      };
    }
  } catch {}

  // Desktop / unsupported → assume plugged-in full battery so backend gets valid values.
  return { level: '100%', charging: 'true' };
}

async function getMediaDevices(): Promise<{
  cameras: string;
  microphones: string;
}> {
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput').length;
      const microphones = devices.filter((d) => d.kind === 'audioinput').length;
      return {
        cameras: String(Math.max(cameras, 0)),
        microphones: String(Math.max(microphones, 0)),
      };
    }
  } catch {}
  return { cameras: '0', microphones: '0' };
}

export function getGeolocation(): Promise<{
  latitude: string | null;
  longitude: string | null;
}> {
  // return Promise.resolve({
  //   latitude: '19.6686667',
  //   longitude: '84.6362222',
  // });
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ latitude: null, longitude: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }),
      () => resolve({ latitude: null, longitude: null }),
      { timeout: 5000, maximumAge: 300000 },
    );
  });
}

type IpInfo = {
  publicIp: string;
  isp: string;
  asn: string;
  city: string;
  country: string;
  ip: string;
  latitude: string;
  longitude: string;
};

function emptyIpInfo(): IpInfo {
  return {
    publicIp: NA,
    isp: NA,
    asn: NA,
    city: NA,
    country: NA,
    ip: NA,
    latitude: NA,
    longitude: NA,
  };
}

function s(v: unknown, fallback = NA): string {
  if (v === null || v === undefined) return fallback;
  const str = String(v).trim();
  return str.length ? str : fallback;
}

async function getIpInfo(): Promise<IpInfo> {
  const endpoints = [
    { url: 'https://ipinfo.io/json', name: 'ipinfo.io' },
    { url: 'https://ipwhois.app/json/', name: 'ipwhois.app' },
    { url: 'https://ipapi.co/json/', name: 'ipapi.co' },
    { url: 'https://ip-api.com/json/', name: 'ip-api.com' },
  ];

  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.get(endpoint.url, { timeout: 3000 });

      if (endpoint.name === 'ipinfo.io') {
        if (!data?.ip) continue;
        const [lat, lon] = String(data.loc || '').split(',');
        return {
          publicIp: s(data.ip),
          isp: s(data.org),
          asn: s(data.org ? String(data.org).split(' ')[0] : ''),
          city: s(data.city),
          country: s(data.country),
          ip: s(data.ip),
          latitude: s(lat),
          longitude: s(lon),
        };
      }

      if (endpoint.name === 'ipwhois.app') {
        if (data?.success === false || !data?.ip) continue;
        return {
          publicIp: s(data.ip),
          isp: s(data.isp || data.org),
          asn: s(data.asn),
          city: s(data.city),
          country: s(data.country_code || data.country),
          ip: s(data.ip),
          latitude: s(data.latitude),
          longitude: s(data.longitude),
        };
      }

      if (endpoint.name === 'ipapi.co') {
        if (data?.error || !data?.ip) continue;
        return {
          publicIp: s(data.ip),
          isp: s(data.org),
          asn: s(data.asn),
          city: s(data.city),
          country: s(data.country || data.country_name),
          ip: s(data.ip),
          latitude: s(data.latitude),
          longitude: s(data.longitude),
        };
      }

      if (endpoint.name === 'ip-api.com') {
        if (data?.status !== 'success') continue;
        return {
          publicIp: s(data.query),
          isp: s(data.isp || data.org),
          asn: s(data.as ? String(data.as).split(' ')[0] : ''),
          city: s(data.city),
          country: s(data.countryCode || data.country),
          ip: s(data.query),
          latitude: s(data.lat),
          longitude: s(data.lon),
        };
      }
    } catch {
      // try next endpoint
    }
  }

  return emptyIpInfo();
}

function estimateMemoryGB(deviceType: string): number {
  if (deviceType === 'mobile') return 4;
  if (deviceType === 'tablet') return 6;
  return 8;
}

function getMemory(deviceType: string): string {
  const nav = navigator as any;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0) {
    return `${nav.deviceMemory} GB`;
  }
  return `${estimateMemoryGB(deviceType)} GB`;
}

function getCpuCores(): string {
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0) return String(cores);
  return '1';
}

function getScreenSize(): string {
  try {
    const w = window.screen?.width || window.innerWidth || 0;
    const h = window.screen?.height || window.innerHeight || 0;
    if (w > 0 && h > 0) return `${w}x${h}`;
  } catch {}
  return '0x0';
}

function getLanguage(): string {
  return s(navigator.language || (navigator as any).userLanguage, 'en-US');
}

function getPlatform(): string {
  const nav = navigator as any;
  const uaPlatform = nav.userAgentData?.platform;
  return s(uaPlatform || navigator.platform, 'Unknown Platform');
}

function detectPossibleIoT(deviceType: string): boolean {
  const cores = navigator.hardwareConcurrency || 0;
  const nav = navigator as any;
  const mem = nav.deviceMemory || 0;
  return (
    cores > 0 && cores <= 2 && mem > 0 && mem <= 1 && deviceType !== 'desktop'
  );
}

// ─── Collect all client info ──────────────────────────────────────────────────

async function collectClientInfo(): Promise<ClientInfo> {
  const [geo, ipInfo, battery, media] = await Promise.all([
    getGeolocation(),
    getIpInfo(),
    getBatteryInfo(),
    getMediaDevices(),
  ]);

  const deviceType = getDeviceType();

  return {
    latitude: s(geo.latitude || ipInfo.latitude),
    longitude: s(geo.longitude || ipInfo.longitude),
    ip: s(ipInfo.ip),
    browser: getBrowser(),
    device: getDevice(),
    userAgent: s(navigator.userAgent, 'Unknown UA'),
    platform: getPlatform(),
    language: getLanguage(),
    cookiesEnabled: !!navigator.cookieEnabled,
    javascriptEnabled: true,
    touchSupport:
      'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0,
    deviceType,
    cpuCores: getCpuCores(),
    memory: getMemory(deviceType),
    screenSize: getScreenSize(),
    batteryLevel: battery.level,
    isCharging: battery.charging,
    gpuRenderer: getGpuRenderer(),
    cameras: media.cameras,
    microphones: media.microphones,
    publicIp: s(ipInfo.publicIp),
    isp: s(ipInfo.isp),
    asn: s(ipInfo.asn),
    city: s(ipInfo.city),
    country: s(ipInfo.country),
    possibleIoT: detectPossibleIoT(deviceType),
  };
}

// ─── Session-cached getter (single fetch per browser session) ─────────────────

let fetchPromise: Promise<ClientInfo> | null = null;

function isValidInfo(data: any): boolean {
  return (
    data &&
    typeof data === 'object' &&
    data.publicIp &&
    data.publicIp !== NA &&
    data.country &&
    data.country !== NA
  );
}

export function getClientInfo(): Promise<ClientInfo> {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // console.log('cached info', data);
      if (isValidInfo(data)) {
        // page is resolved per-call (path changes as the user navigates),
        // so it is never read from / written to the session cache.
        return Promise.resolve({ ...data, page: getCurrentPage() });
      }
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {}

  if (!fetchPromise) {
    fetchPromise = collectClientInfo()
      .then((info) => {
        console.log('client info', info);
        try {
          if (isValidInfo(info)) {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(info));
          }
        } catch {}
        return info;
      })
      .catch(() => collectClientInfo().catch(() => ({}) as ClientInfo));
  }

  return fetchPromise.then((info) => ({ ...info, page: getCurrentPage() }));
}

export function clearClientInfoCache(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
  fetchPromise = null;
}

export async function hasGeolocationPermission(): Promise<
  'granted' | 'denied' | 'prompt' | 'unsupported'
> {
  if (typeof navigator === 'undefined' || !navigator.geolocation)
    return 'unsupported';
  try {
    if (navigator.permissions?.query) {
      const result = await navigator.permissions.query({
        name: 'geolocation' as PermissionName,
      });
      return result.state as 'granted' | 'denied' | 'prompt';
    }
  } catch {}
  return 'prompt';
}

// Auto-fetch on page load so it's ready before first API call
if (typeof window !== 'undefined') {
  getClientInfo();
}
