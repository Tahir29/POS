// src/store/persistConfig.js
// Redux Persist configuration for Lucira POS.
// Only explicitly whitelisted slices are persisted.
// Source of truth: ARCHITECTURE.md Section 18

import storage from 'redux-persist/lib/storage';

// ── ROOT PERSIST CONFIG ──────────────────────────────────────
// Whitelist controls exactly which slices survive a page refresh.
// ui slice is intentionally excluded — always resets on load.
const persistConfig = {
  key:       'lucira-pos-root',
  storage,
  whitelist: ['auth', 'cart', 'store'],
  // 'ui' is NOT in the whitelist — resets on every load
};

export default persistConfig;