'use client';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { persistor, store } from '@/redux/store';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { PersistGate } from 'redux-persist/integration/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <Toaster position="top-right" richColors />
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
            {children}
         </AuthProvider>
      </PersistGate>
    </Provider>
  );
}
