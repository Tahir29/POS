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

// ONE in-flight refresh promise, shared by BOTH the request interceptor's
// proactive refresh (token nearing expiry) and the response interceptor's
// reactive refresh (401 came back). These used to be two independent code
// paths — the reactive one had a lock (an isRefreshing flag + a pending
// queue), the proactive one had none at all.
//
// That gap is exactly what caused a healthy session to get logged out right
// after checkout: checkout is the one flow that reliably fires several
// requests at once (useInvoiceHelpers' 6 balance calls on mount, then the
// invalidateQueries(['invoices'|'orders']) burst the instant Create/Post
// succeeds), and its own submit chain is slow enough (sequential stock
// claims, multi-second SetSalesItems, ApplyPromotions, Create, Post) to let
// the token age into its 5-minute refresh window by the time that second
// burst lands. With no lock, every one of those concurrent requests
// independently POSTed grant_type=refresh_token with the SAME refresh
// token. OrnaVerse's refresh token is single-use: only the first of those
// calls succeeds, the rest come back invalid_grant — and since each was
// swallowed silently (see the old `catch {}` this replaced), the "losing"
// requests sailed on with the stale access token, got a real 401, and the
// response interceptor's own refresh attempt then ALSO failed (the refresh
// token had already been rotated/consumed by the winning proactive call) —
// which is what actually called handleLogout(). One coordinator for both
// paths means at most one refresh call is ever in flight, so this race
// cannot happen no matter how many requests need a refresh at once.
let refreshPromise = null;

/**
 * Returns the token from the currently in-flight refresh, starting one if
 * none is running. Every caller — proactive or reactive, however many fire
 * concurrently — awaits this SAME promise and gets the same outcome.
 */
const getRefreshedToken = (instance, refreshToken, store) => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(instance, refreshToken, store)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

// We import the store lazily (inside functions) to avoid circular
// dependency issues between axiosInstance → interceptors → store.
const getStore = () => require('@/store').store;

/**
 * Attaches request and response interceptors to the provided Axios instance.
 * Called once during axiosInstance creation.
 *
 * @param {import('axios').AxiosInstance} instance
 */
export const attachInterceptors = (instance) => {

  instance.interceptors.request.use(
    async (config) => {
      const store = getStore();
      const state = store.getState();

      const accessToken  = state.auth.accessToken;
      const tokenExpiry  = state.auth.tokenExpiry;
      const refreshToken = state.auth.refreshToken;

      const isAuthEndpoint = config.url?.includes('connect/token');
      if (isAuthEndpoint) {
        return config;
      }

      // Proactively refresh if token is within the threshold window. Routed
      // through the shared coordinator (see getRefreshedToken above) — if
      // another request already started this refresh, this one waits for
      // and reuses that SAME call rather than firing its own with the same
      // (single-use) refresh token.
      if (
        accessToken &&
        tokenExpiry &&
        refreshToken &&
        Date.now() >= tokenExpiry - APP_CONFIG.AUTH.TOKEN_REFRESH_THRESHOLD_MS
      ) {
        try {
          const newToken = await getRefreshedToken(instance, refreshToken, store);
          config.headers['Authorization'] = `Bearer ${newToken}`;
          return config;
        } catch {
          // Refresh failed — let the request proceed and handle 401 in response interceptor
        }
      }

      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,

    async (error) => {
      const originalRequest = error.config;
      const status          = error.response?.status;
      const store           = getStore();

      if (status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        const refreshToken = store.getState().auth.refreshToken;

        if (!refreshToken) {
          handleLogout(store);
          return Promise.reject(normalizeError(error));
        }

        // Shared coordinator — if a proactive refresh (or another request's
        // reactive one) is already in flight, this awaits that SAME call
        // instead of starting a second one with the same refresh token.
        try {
          const newToken = await getRefreshedToken(instance, refreshToken, store);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          handleLogout(store);
          return Promise.reject(normalizeError(refreshError));
        }
      }

      return Promise.reject(normalizeError(error));
    }
  );
};

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

  const { updateTokens } = require('@/store/slices/authSlice');
  store.dispatch(updateTokens({
    accessToken:  access_token,
    refreshToken: refresh_token,
    expiresIn:    expires_in,
  }));

  return access_token;
};

/**
 * Clears Redux auth/store/cart/recently-viewed/wishlist state, the query
 * cache, and the analytics tracker, then redirects to login. Called when
 * the refresh token is expired or missing — i.e. the session simply timed
 * out, not something an operator chose.
 *
 * FIXED 2026-08-27: this used to only clear auth/store/cookies — a much
 * thinner cleanup than useAuth.js's manual logout(), which explicitly
 * clears cart, recentlyViewed, wishlist, purges the persistor, clears the
 * tracker, and clears the query client (see that function's own comments
 * for why each one matters on a SHARED terminal). A forced session-expiry
 * logout is exactly as much a "this operator's session is over" moment as
 * a manual one — arguably more so, since it can happen mid-shift with no
 * warning — so it needs the same cleanup, not a lighter one. Concretely:
 * `cart` IS in persistConfig's whitelist (unlike recentlyViewed/wishlist,
 * which reset for free on the reload below since they're in-memory-only),
 * so without dispatching clearCart here, a customer's in-progress cart
 * survived in localStorage straight through a forced logout and was still
 * there for whoever logged in next on the same terminal — confirmed by
 * reading persistConfig.js's whitelist, not assumed.
 *
 * FIXED 2026-08-27 (second pass) — the reported bug: "once the order is
 * placed, the customer logs out automatically, which shouldn't happen at
 * all". Root cause traced end to end: checkout's Create→Post chain is
 * exactly the slow, sequential, multi-call flow the race-condition comment
 * on `refreshPromise` above already describes crossing into the token's
 * refresh window. When the reactive refresh on a mid-chain 401 ALSO fails
 * (refresh token already used/expired), this function used to redirect via
 * `window.location.href` in the SAME synchronous tick that the failed
 * request's promise rejects — before the rejection had even propagated
 * back to useCreateOrder/useCreateInvoice's onError, let alone before
 * React had a chance to paint that mutation's own toast.error(...). The
 * operator saw the screen just vanish to /login with no explanation, and —
 * worse — Create had usually already succeeded (a real transaction_id
 * exists server-side), so it read as data loss, not just an abrupt logout;
 * see TOAST.ORDERS/INVOICES.POST_FAILED for the other half of this fix
 * (naming that transaction_id so it's findable instead of just "failed").
 * Fixed by explicitly showing a toast HERE and delaying the actual
 * navigation — long enough for both toasts (this one, and whatever
 * mutation's own onError just fired) to render before the page tears down.
 *
 * @param {object} store - Redux store
 */
const handleLogout = (store) => {
  const { clearAuth }  = require('@/store/slices/authSlice');
  const { clearStore } = require('@/store/slices/storeSlice');
  const { clearCart } = require('@/store/slices/cartSlice');
  const { clearRecentlyViewed } = require('@/store/slices/recentlyViewedSlice');
  const { clearWishlist } = require('@/store/slices/wishlistSlice');
  const { clearAllCookies } = require('@/lib/cookies');
  const { persistor } = require('@/store');
  const queryClient = require('@/lib/queryClient').default;
  const tracker = require('@/lib/analytics/tracker').default;
  const { destroyReportSession } = require('@/services/authService');
  const { toast } = require('react-toastify');

  // Best-effort — a session that's already timed out server-side may well
  // reject this too; it must never block the local cleanup below.
  destroyReportSession().catch(() => {});

  store.dispatch(clearAuth());
  store.dispatch(clearStore());
  // reason: 'session_reset' — same as useAuth.js's manual logout: this is
  // the SESSION ending, not the customer's cart being resolved, so an
  // unpaid cart is preserved as abandoned rather than deleted outright
  // (see abandonedCartMiddleware's cart/clearCart case).
  store.dispatch(clearCart({ reason: 'session_reset' }));
  store.dispatch(clearRecentlyViewed());
  store.dispatch(clearWishlist());
  // Match normal logout — don't let a stale backend cookie survive
  // a forced logout any more than a manual one.
  clearAllCookies();
  // Actually deletes the persisted localStorage entry rather than leaving
  // an empty-but-present one — see useAuth.js logout()'s own comment on
  // why the resets above aren't enough by themselves.
  persistor.purge();
  tracker.clear();
  // NOTE: queryClient.clear() is deliberately NOT called synchronously here
  // any more — it used to run before the delayed redirect below, which
  // meant a mutation's own onError (still queued for this same tick) could
  // fire against an already-cleared query client. Clearing happens right
  // before the redirect instead, after every pending toast has had its
  // chance to render.

  toast.error('Your session has expired. Please log in again — check Orders/Invoices for anything you were just placing.');

  // Redirect to login — works in both browser and Next.js context. Delayed
  // (not immediate) so a mutation's own onError — e.g. useCreateOrder's
  // "Order created (ref #X) but couldn't be finalised" — has time to reach
  // the toast container and actually be seen before the page tears down.
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      queryClient.clear();
      window.location.href = '/login';
    }, 2500);
  } else {
    queryClient.clear();
  }
};

/**
 * Pulls the human-readable reason out of an OrnaVerse error body.
 *
 * OrnaVerse is a Serenity app: it reports both field validation AND business
 * rules as `{ "Error": { "Code": "...", "Message": "..." } }` — capital E,
 * capital M. Nothing here is at `data.message`, which is what this function
 * used to look for, so EVERY OrnaVerse reason was silently dropped and the
 * operator only ever saw the generic fallback below.
 *
 * That is how failures like "21278E2 Item cost must be a valid non-negative
 * amount" and "Not enough stock of 21278E2 can not Save" reached the counter
 * as nothing more than "Failed to create invoice. Please try again." — the
 * server was saying exactly what was wrong and we were discarding it.
 *
 * These messages are written for a shop operator, not a developer ("Not
 * enough stock of <sku>"), so showing them is the correct behaviour, not a
 * debug leak.
 */
const extractServerMessage = (data) => {
  if (!data) return null;
  if (typeof data === 'string') return data.trim() || null;
  return (
    data.Error?.Message ??      // Serenity business rule / validation
    data.error_description ??   // OAuth token endpoint
    data.Message ??             // bare ASP.NET fault
    data.message ??             // generic JSON API
    null
  );
};

/**
 * Converts any Axios error into a consistent normalized shape.
 * Raw API errors never reach the UI — components receive this object.
 * Source of truth: ARCHITECTURE.md Section 24 (Error Handling)
 *
 * `serverMessage` carries OrnaVerse's own reason when it sent one, so callers
 * can show the actual cause instead of a generic retry prompt. `response` is
 * passed through deliberately: callers already reach for
 * `error.response.data.Error.Message`, and stripping it made those reads
 * silently undefined.
 *
 * @param {import('axios').AxiosError} error
 * @returns {{ code: number, message: string, details: string|null,
 *             retryable: boolean, serverMessage: string|null, response?: object }}
 */
const normalizeError = (error) => {
  // DEV-ONLY DEBUG — logs the ACTUAL raw response body from OrnaVerse,
  // which normalizeError below normally discards in favor of a generic
  // user-facing message. Was previously unconditional and shipped to
  // production, where it printed full upstream response bodies (which can
  // carry customer/invoice PII on business-data endpoints) to the browser
  // console on every failed request — a real leak path if anyone screen-
  // shares or screen-records a support session. Gated to development only
  // (2026-08-18 security pass); keep this guard if the logging is ever
  // needed again for a live issue.
  if (error.response && process.env.NODE_ENV !== 'production') {
    console.error(
      '[normalizeError] RAW error response:',
      error.config?.url,
      error.response.status,
      JSON.stringify(error.response.data, null, 2)
    );
  }

  if (!error.response) {
    return {
      code:          0,
      message:       'Network error. Please check your connection.',
      details:       error.message ?? null,
      retryable:     true,
      serverMessage: null,
    };
  }

  const { status, data } = error.response;
  const serverMessage = extractServerMessage(data);

  // Session/permission problems are about the session, not the payload — the
  // server's wording there ("invalid_grant") is worse than ours, so those two
  // keep the fixed copy. Everywhere else OrnaVerse's own reason wins.
  const errorMap = {
    400: { message: serverMessage ?? 'Invalid request. Please check your inputs.',    retryable: false },
    401: { message: 'Your session has expired. Please log in again.',                 retryable: false },
    403: { message: 'You do not have permission to perform this action.',             retryable: false },
    404: { message: serverMessage ?? 'The requested resource was not found.',         retryable: false },
    422: { message: serverMessage ?? 'Validation failed. Please check your inputs.',  retryable: false },
    429: { message: 'Too many requests. Please wait a moment and try again.',         retryable: true  },
  };

  const mapped = errorMap[status];

  if (mapped) {
    return {
      code: status, details: serverMessage, serverMessage,
      response: error.response, ...mapped,
    };
  }

  // 5xx — OrnaVerse returns business-rule rejections as 500 with a real
  // reason in the body ("Not enough stock of <sku> can not Save"), so prefer
  // it over the generic retry prompt. A 500 with no body stays retryable;
  // one that named a cause is a rejection, not a blip, and retrying it
  // unchanged will fail identically.
  if (status >= 500) {
    return {
      code:          status,
      message:       serverMessage ?? 'Server error. Please try again in a moment.',
      details:       serverMessage,
      retryable:     !serverMessage,
      serverMessage,
      response:      error.response,
    };
  }

  return {
    code:          status,
    message:       serverMessage ?? 'Something went wrong. Please try again.',
    details:       serverMessage,
    retryable:     true,
    serverMessage,
    response:      error.response,
  };
};