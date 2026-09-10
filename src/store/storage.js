// src/store/storage.js
// SSR-safe storage engine for Redux Persist.
//
// `redux-persist/lib/storage` decides its engine at import time; under Next.js
// that module is first evaluated on the server, where localStorage doesn't
// exist, so it permanently falls back to a no-op and every slice is lost on
// refresh. This picks the engine per environment instead: real localStorage
// in the browser, a no-op on the server.

import createWebStorage from 'redux-persist/lib/storage/createWebStorage';

/**
 * Server-side stand-in. Redux Persist only needs these three methods, and on
 * the server every call is a no-op — rehydration happens in the browser.
 */
function createNoopStorage() {
  return {
    getItem:    () => Promise.resolve(null),
    setItem:    (_key, value) => Promise.resolve(value),
    removeItem: () => Promise.resolve(),
  };
}

const storage =
  typeof window !== 'undefined'
    ? createWebStorage('local')
    : createNoopStorage();

export default storage;
