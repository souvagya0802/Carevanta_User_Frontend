'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthProvider } from './auth';
import { ToastProvider } from '@/components/ui/toast';
import { ApiError } from './api';
import { PatientUiProvider } from './patient-ui';
import { LocationProvider } from './location';
import { CartProvider } from './cart';
import { registerServiceWorker } from './push';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => { void registerServiceWorker(); }, []);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PatientUiProvider>
          <LocationProvider>
            <CartProvider>
              <AuthProvider>{children}</AuthProvider>
            </CartProvider>
          </LocationProvider>
        </PatientUiProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
