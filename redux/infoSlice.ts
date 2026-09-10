import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InfoState {
  latitude: string | null;
  longitude: string | null;
  ip: string | null;
  browser: string | null;
  device: string | null;
  userAgent: string | null;
  platform: string | null;
  language: string | null;
  cookiesEnabled: boolean | null;
  javascriptEnabled: boolean | null;
  touchSupport: boolean | null;
  deviceType: string | null;
  cpuCores: number | null;
  memory: string | null;
  screenSize: string | null;
  batteryLevel: string | null;
  isCharging: string | null;
  gpuRenderer: string | null;
  cameras: string | null;
  microphones: string | null;
  publicIp: string | null;
  isp: string | null;
  asn: string | null;
  city: string | null;
  country: string | null;
  possibleIoT: boolean | null;
  fetched: boolean;
}

const initialState: InfoState = {
  latitude: null,
  longitude: null,
  ip: null,
  browser: null,
  device: null,
  userAgent: null,
  platform: null,
  language: null,
  cookiesEnabled: null,
  javascriptEnabled: null,
  touchSupport: null,
  deviceType: null,
  cpuCores: null,
  memory: null,
  screenSize: null,
  batteryLevel: null,
  isCharging: null,
  gpuRenderer: null,
  cameras: null,
  microphones: null,
  publicIp: null,
  isp: null,
  asn: null,
  city: null,
  country: null,
  possibleIoT: null,
  fetched: false,
};

export const infoSlice = createSlice({
  name: 'info',
  initialState,
  reducers: {
    setInfo: (state, action: PayloadAction<InfoState>) => {
      return { ...state, ...action.payload };
    },
  },
});

export const { setInfo } = infoSlice.actions;
export default infoSlice.reducer;
