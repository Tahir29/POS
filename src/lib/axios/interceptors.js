// src/lib/axios/interceptors.js
// Request and response interceptors for the Lucira POS Axios instance.
//
// Request interceptor:
//   — Attaches Authorization: Bearer {accessToken} to every request
//   — Checks token expiry and proactively refreshes if within threshold
//
// Response interceptor:
//   — Catches 401 responses
//   — Attempts token refresh once
//   — Retries the original request with the new token
//   — If refresh fails, clears auth state and redirects to login
//
// Source of truth: ARCHITECTURE.md Section 5 (Authentication Strategy)

import axios from 'axios';
import APP_CONFIG from '@/constants/appConfig';
import API from '@/constants/apiEndpoints';

// ── TOKEN REFRESH STATE ───────────────────────────────────────
// Prevents multiple simultaneous refresh calls when parallel
// requests all get a 401 at the same time.
let isRefreshing = false;
let pendingQueue = []; // requests waiting for refresh to complete

const processPendingQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  pendingQueue = [];
};

// ── STORE REFERENCE ───────────────────────────────────────────
// We import the store lazily (inside functions) to avoid circular
// dependency issues between axiosInstance → interceptors → store.
const getStore = () => require('@/store').store;

// ── ATTACH INTERCEPTORS ───────────────────────────────────────
/**
 * Attaches request and response interceptors to the provided Axios instance.
 * Called once during axiosInstance creation.
 *
 * @param {import('axios').AxiosInstance} instance
 */
export const attachInterceptors = (instance) => {

  // ── REQUEST INTERCEPTOR ─────────────────────────────────────
  instance.interceptors.request.use(
    async (config) => {
      const store = getStore();
      const state = store.getState();

      const accessToken  = state.auth.accessToken;
      const tokenExpiry  = state.auth.tokenExpiry;
      const refreshToken = state.auth.refreshToken;

      // Skip auth header for the token endpoint itself
      const isAuthEndpoint = config.url?.includes('connect/token');
      if (isAuthEndpoint) {
        return config;
      }

      // Proactively refresh if token is within the threshold window
      if (
        accessToken &&
        tokenExpiry &&
        refreshToken &&
        Date.now() >= tokenExpiry - APP_CONFIG.AUTH.TOKEN_REFRESH_THRESHOLD_MS
      ) {
        try {
          const newToken = await refreshAccessToken(instance, refreshToken, store);
          config.headers['Authorization'] = `Bearer ${newToken}`;
          return config;
        } catch {
          // Refresh failed — let the request proceed and handle 401 in response interceptor
        }
      }

      // Attach current access token
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // ── RESPONSE INTERCEPTOR ────────────────────────────────────
  instance.interceptors.response.use(
    // Success — pass through unchanged
    (response) => response,

    // Error — handle 401 and normalize all errors
    async (error) => {
      const originalRequest = error.config;
      const status          = error.response?.status;
      const store           = getStore();

      // ── 401 HANDLING ───────────────────────────────────────
      if (status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        const refreshToken = store.getState().auth.refreshToken;

        // No refresh token available — log out immediately
        if (!refreshToken) {
          handleLogout(store);
          return Promise.reject(normalizeError(error));
        }

        // Another refresh is already in progress — queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return instance(originalRequest);
          }).catch((err) => Promise.reject(err));
        }

        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken(instance, refreshToken, store);
          processPendingQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          processPendingQueue(refreshError, null);
          handleLogout(store);
          return Promise.reject(normalizeError(refreshError));
        } finally {
          isRefreshing = false;
        }
      }

      // ── ALL OTHER ERRORS ────────────────────────────────────
      return Promise.reject(normalizeError(error));
    }
  );
};

// ── REFRESH ACCESS TOKEN ──────────────────────────────────────
/**
 * Calls the OrnaVerse refresh token endpoint and updates Redux auth state.
 * Returns the new access token string on success.
 * Throws on failure.
 *
 * @param {import('axios').AxiosInstance} instance
 * @param {string} refreshToken
 * @param {object} store - Redux store
 * @returns {Promise<string>} new access token
 */
const refreshAccessToken = async (instance, refreshToken, store) => {
  const params = new URLSearchParams();
  params.append('grant_type',    APP_CONFIG.AUTH.GRANT_TYPE_REFRESH);
  params.append('refresh_token', refreshToken);
  params.append('client_id',     APP_CONFIG.AUTH.CLIENT_ID);

  const response = await instance.post(API.AUTH.REFRESH_TOKEN, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in } = response.data;

  // Update Redux auth state with new tokens
  const { updateTokens } = require('@/store/slices/authSlice');
  store.dispatch(updateTokens({
    accessToken:  access_token,
    refreshToken: refresh_token,
    expiresIn:    expires_in,
  }));

  return access_token;
};

// ── HANDLE LOGOUT ─────────────────────────────────────────────
/**
 * Clears Redux auth and store state, then redirects to login.
 * Called when refresh token is expired or missing.
 *
 * @param {object} store - Redux store
 */
const handleLogout = (store) => {
  const { clearAuth }  = require('@/store/slices/authSlice');
  const { clearStore } = require('@/store/slices/storeSlice');

  store.dispatch(clearAuth());
  store.dispatch(clearStore());

  // Redirect to login — works in both browser and Next.js context
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

// ── NORMALIZE ERROR ───────────────────────────────────────────
/**
 * Converts any Axios error into a consistent normalized shape.
 * Raw API errors never reach the UI — components receive this object.
 * Source of truth: ARCHITECTURE.md Section 24 (Error Handling)
 *
 * @param {import('axios').AxiosError} error
 * @returns {{ code: number, message: string, details: string|null, retryable: boolean }}
 */
const normalizeError = (error) => {
  // Network error — no response received
  if (!error.response) {
    return {
      code:      0,
      message:   'Network error. Please check your connection.',
      details:   error.message ?? null,
      retryable: true,
    };
  }

  const { status, data } = error.response;

  const errorMap = {
    400: { message: data?.message ?? 'Invalid request. Please check your inputs.',   retryable: false },
    401: { message: 'Your session has expired. Please log in again.',                retryable: false },
    403: { message: 'You do not have permission to perform this action.',             retryable: false },
    404: { message: 'The requested resource was not found.',                         retryable: false },
    422: { message: data?.message ?? 'Validation failed. Please check your inputs.', retryable: false },
    429: { message: 'Too many requests. Please wait a moment and try again.',        retryable: true  },
  };

  const mapped = errorMap[status];

  if (mapped) {
    return { code: status, details: null, ...mapped };
  }

  // 5xx and anything else
  if (status >= 500) {
    return {
      code:      status,
      message:   'Server error. Please try again in a moment.',
      details:   null,
      retryable: true,
    };
  }

  return {
    code:      status,
    message:   'Something went wrong. Please try again.',
    details:   null,
    retryable: true,
  };
};