// src/store/persistConfig.js
// Redux Persist configuration for Lucira POS.
// Only explicitly whitelisted slices are persisted.
// Source of truth: ARCHITECTURE.md Section 18

// NOT 'redux-persist/lib/storage' — that resolves its engine at import time,
// which under Next.js happens on the server first and pins it to a no-op for
// the rest of the session. See store/storage.js.
import storage from './storage';

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