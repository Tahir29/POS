// src/components/shared/Providers/index.jsx
// Single wrapper for all application providers.
// Mounted once in src/app/layout.jsx — never duplicated.
// Order matters: Redux → Persist → QueryClient → Toast

'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { store, persistor } from '@/store';
import queryClient from '@/lib/queryClient';
import { queryPersister, PERSIST_MAX_AGE, PERSIST_BUSTER, shouldPersistQuery } from '@/lib/queryPersister';
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
        {/* PersistQueryClientProvider (2026-08-23), not the plain
            QueryClientProvider this used to be — restores a narrow,
            explicitly-allow-listed slice of the cache (catalog list +
            Shopify product images, see lib/queryPersister.js) from
            IndexedDB on load, so a full page reload doesn't throw away
            data that can take a while to fetch fresh. Every other query
            (price, stock, cart, customer, orders, …) behaves exactly as
            before — this only adds a restore step, it doesn't change
            in-memory query behavior for anything not on that allow-list. */}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: PERSIST_MAX_AGE,
            buster: PERSIST_BUSTER,
            dehydrateOptions: {
              shouldDehydrateQuery: shouldPersistQuery,
            },
          }}
        >

          {children}

          <ToastContainer
            position="bottom-center"
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

        </PersistQueryClientProvider>
      </PersistGate>
    </Provider>
  );
}