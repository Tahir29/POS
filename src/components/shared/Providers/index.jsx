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

/** @param {{ children: React.ReactNode }} props */
export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <PersistGate
        loading={<LoadingSpinner fullScreen />}
        persistor={persistor}
      >
        {/* Restores only an allow-listed slice of the query cache (catalog
            list + Shopify product images, see lib/queryPersister.js) from
            IndexedDB; all other queries behave as plain in-memory react-query. */}
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