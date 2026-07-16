// src/store/index.js
// Root Redux store configuration for Lucira POS.
// Wires all slices together with Redux Persist.

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';

import persistConfig  from './persistConfig';
import authReducer    from './slices/authSlice';
import cartReducer    from './slices/cartSlice';
import storeReducer   from './slices/storeSlice';
import uiReducer      from './slices/uiSlice';
import { analyticsMiddleware } from './analyticsMiddleware';

// ── COMBINE ALL REDUCERS ──────────────────────────────────────
const rootReducer = combineReducers({
  auth:  authReducer,
  cart:  cartReducer,
  store: storeReducer,
  ui:    uiReducer,
});

// ── WRAP WITH PERSIST ─────────────────────────────────────────
const persistedReducer = persistReducer(persistConfig, rootReducer);

// ── CONFIGURE STORE ───────────────────────────────────────────
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Required by Redux Persist — ignore its internal action types
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(analyticsMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// ── PERSISTOR ─────────────────────────────────────────────────
export const persistor = persistStore(store);