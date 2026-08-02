// src/store/storage.js
// SSR-safe storage engine for Redux Persist.
//
// WHY THIS EXISTS: `redux-persist/lib/storage` decides its engine at import
// time. Under Next.js that module is first evaluated on the SERVER, where
// `localStorage` doesn't exist, so it logs
//   "redux-persist failed to create sync storage. falling back to noop storage."
// and permanently uses a no-op — nothing is ever written, and every slice is
// lost on refresh.
//
// Symptom this caused: a hard refresh mid-sale emptied the cart and dropped
// the attached customer. Confirmed live 2026-08-01 — an in-progress basket
// vanished on reload.
//
// The fix is to pick the engine per environment: real localStorage in the
// browser, a no-op on the server (where there is nothing to persist anyway).

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
