'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  clearClientInfoCache,
  getClientInfo,
  getGeolocation,
  hasGeolocationPermission,
} from '@/lib/header';

type Status = 'checking' | 'granted' | 'denied' | 'unsupported';

interface LocationGateProps {
  children: React.ReactNode;
}

export default function LocationGate({ children }: LocationGateProps) {
  const [status, setStatus] = useState<Status>('checking');
  const [requesting, setRequesting] = useState(false);

  const check = useCallback(async () => {
    setStatus('checking');

    const perm = await hasGeolocationPermission();
    if (perm === 'unsupported') {
      setStatus('unsupported');
      return;
    }
    if (perm === 'denied') {
      setStatus('denied');
      return;
    }

    const coords = await getGeolocation();
    if (coords.latitude && coords.longitude) {
      setStatus('granted');
      clearClientInfoCache();
      getClientInfo();
    } else {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const requestLocation = async () => {
    setRequesting(true);
    try {
      await check();
    } finally {
      setRequesting(false);
    }
  };

  if (status === 'granted') return <>{children}</>;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            {status === 'checking' ? (
              <MapPin className="h-8 w-8 animate-pulse text-emerald-400" />
            ) : status === 'unsupported' ? (
              <ShieldAlert className="h-8 w-8 text-red-400" />
            ) : (
              <MapPin className="h-8 w-8 text-emerald-400" />
            )}
          </div>

          <h2 className="mb-3 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent">
            {status === 'checking'
              ? 'Verifying location…'
              : status === 'unsupported'
                ? 'Location unsupported'
                : 'Location required'}
          </h2>

          <p className="mb-6 max-w-md text-sm leading-relaxed text-slate-400">
            {status === 'checking'
              ? 'Hang tight while we verify your device location.'
              : status === 'unsupported'
                ? 'Your browser does not support geolocation. Please switch to a modern browser to continue.'
                : 'Scaninfoga requires precise device location before you can sign in or register. Enable location in the browser address bar, then retry.'}
          </p>

          {status === 'denied' && (
            <div className="mb-6 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left text-xs text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">
                How to enable location
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Click the location/lock icon beside the URL bar.</li>
                <li>
                  Set <span className="text-emerald-400">Location</span> to
                  Allow for this site.
                </li>
                <li>Press retry below.</li>
              </ol>
            </div>
          )}

          {status !== 'unsupported' && (
            <Button
              type="button"
              onClick={requestLocation}
              loading={requesting || status === 'checking'}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 font-semibold text-black hover:shadow-lg hover:shadow-emerald-500/25"
            >
              <RefreshCw className="h-4 w-4" />
              {status === 'checking' ? 'Checking…' : 'Retry location access'}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
