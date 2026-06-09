// src/store/slices/authSlice.js
// Manages authentication state — tokens, expiry, login status.
// Persisted via Redux Persist (survives page refresh).
// API calls are NOT made here — TanStack Query handles that.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken:  null,
  refreshToken: null,
  tokenExpiry:  null,   // timestamp in ms — Date.now() + expires_in * 1000
  isAuthenticated: false,
  user: null,           // { username } — populated after login
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {

    // Called after a successful login or token refresh
    setTokens: (state, action) => {
      const { accessToken, refreshToken, expiresIn, username } = action.payload;
      state.accessToken     = accessToken;
      state.refreshToken    = refreshToken;
      state.tokenExpiry     = Date.now() + expiresIn * 1000;
      state.isAuthenticated = true;
      state.user            = { username };
    },

    // Called when token is refreshed — updates tokens only
    updateTokens: (state, action) => {
      const { accessToken, refreshToken, expiresIn } = action.payload;
      state.accessToken  = accessToken;
      state.refreshToken = refreshToken;
      state.tokenExpiry  = Date.now() + expiresIn * 1000;
    },

    // Called on logout or refresh token failure
    clearAuth: (state) => {
      state.accessToken     = null;
      state.refreshToken    = null;
      state.tokenExpiry     = null;
      state.isAuthenticated = false;
      state.user            = null;
    },

  },
});

// ── ACTIONS ──────────────────────────────────────────────────
export const { setTokens, updateTokens, clearAuth } = authSlice.actions;

// ── SELECTORS ────────────────────────────────────────────────
export const selectAccessToken     = (state) => state.auth.accessToken;
export const selectRefreshToken    = (state) => state.auth.refreshToken;
export const selectTokenExpiry     = (state) => state.auth.tokenExpiry;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthUser        = (state) => state.auth.user;

export default authSlice.reducer;