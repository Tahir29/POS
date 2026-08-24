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
import recentlyViewedReducer from './slices/recentlyViewedSlice';
import abandonedCartReducer from './slices/abandonedCartSlice';
import wishlistReducer from './slices/wishlistSlice';
import { analyticsMiddleware } from './analyticsMiddleware';
import { recentlyViewedMiddleware } from './recentlyViewedMiddleware';
import { abandonedCartMiddleware } from './abandonedCartMiddleware';
import { wishlistMiddleware } from './wishlistMiddleware';

const rootReducer = combineReducers({
  auth:  authReducer,
  cart:  cartReducer,
  store: storeReducer,
  ui:    uiReducer,
  recentlyViewed: recentlyViewedReducer,
  abandonedCart: abandonedCartReducer,
  wishlist: wishlistReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Required by Redux Persist — ignore its internal action types
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(analyticsMiddleware, recentlyViewedMiddleware, abandonedCartMiddleware, wishlistMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);