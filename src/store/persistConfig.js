// src/store/persistConfig.js
// Redux Persist configuration for Lucira POS.
// Only explicitly whitelisted slices are persisted.
// Source of truth: ARCHITECTURE.md Section 18

// Uses the SSR-safe engine from ./storage, not 'redux-persist/lib/storage' directly — see that file.
import storage from './storage';

// Whitelist controls exactly which slices survive a page refresh.
// ui slice is intentionally excluded — always resets on load.
const persistConfig = {
  key:       'lucira-pos-root',
  storage,
  whitelist: ['auth', 'cart', 'store'],
};

export default persistConfig;