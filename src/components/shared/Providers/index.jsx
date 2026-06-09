// src/components/shared/Providers/index.jsx
// Single wrapper for all application providers.
// Mounted once in src/app/layout.jsx — never duplicated.
// Order matters: Redux → Persist → QueryClient → Toast

'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { store, persistor } from '@/store';
import queryClient from '@/lib/queryClient';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

/**
 * Providers
 * Wraps the entire application with all required context providers.
 * Mount order: Redux → PersistGate → QueryClientProvider → Toast
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <PersistGate
        loading={<LoadingSpinner fullScreen />}
        persistor={persistor}
      >
        <QueryClientProvider client={queryClient}>

          {children}

          {/* Toast container — mounted once, globally available */}
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={true}
            closeOnClick={true}
            pauseOnHover={true}
            draggable={false}
            theme="light"
          />

          {/* TanStack Query DevTools — dev only, removed in production build */}
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-left"
          />

        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}