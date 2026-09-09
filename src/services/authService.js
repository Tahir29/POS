import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Authenticates a user with username and password.
 * Uses application/x-www-form-urlencoded as required by OrnaVerse OAuth endpoint.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ access_token, refresh_token, expires_in, token_type }>}
 */
export async function generateToken(username, password) {
  const params = new URLSearchParams();
  params.append('username', username);
  params.append('password', password);
  params.append('grant_type', APP_CONFIG.AUTH.GRANT_TYPE_PASSWORD);
  params.append('client_id', APP_CONFIG.AUTH.CLIENT_ID);
  params.append('scope', APP_CONFIG.AUTH.SCOPE);

  const response = await axiosInstance.post(API.AUTH.GENERATE_TOKEN, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipAuth: true,
  });

  return response.data;
}

/**
 * Establishes the operator's OrnaVerse COOKIE session, used only for
 * rendering invoice reports.
 *
 * Called with the same credentials that just produced the access token.
 * /Print/Render is cookie-authenticated and ignores bearer tokens entirely,
 * so without this the invoice formats OrnaVerse offers can't be fetched —
 * see lib/ornaverse/reportSession.js for why this beats a stored service
 * account. The password goes to our own server route and no further; the
 * session id comes back as an httpOnly cookie this code never sees.
 *
 * FIXED 2026-09-09 — this used to be exactly one attempt, fired without
 * awaiting its result from useAuth.js's login() (see that function's own
 * comment). createReportSession's own pipeline (lib/ornaverse/reportSession.js)
 * is a THREE-hop dance against OrnaVerse (GET login page for an antiforgery
 * cookie, POST credentials, GET again authenticated for a fresh CSRF pair) —
 * any one of those three hitting a transient blip failed the whole session
 * silently, with the operator finding out only much later at print time
 * ("Your OrnaVerse print session has expired") — reported live 2026-09-09.
 * Confirmed live the same day that a single fresh attempt against LIVE
 * succeeds cleanly on its own, so this isn't a broken pipeline — it's a
 * one-shot call with zero tolerance for a one-off network hiccup. Retrying
 * a couple of times, a short beat apart, converts most transient failures
 * into a login-time success instead of a mid-shift surprise, at the cost of
 * at most ~1.5s more (only on the RETRY path — success on the first try, the
 * overwhelmingly common case, costs the same one round-trip as before).
 *
 * Still NEVER lets a genuine failure reject into the login flow: printing is
 * the only thing that depends on it, and a POS that won't open because a
 * report session failed is far worse than one that can't print until the
 * operator reconnects (see InvoiceReportButton's reconnect panel — this is
 * the safety net for whatever this retry doesn't recover).
 *
 * @returns {Promise<boolean>} whether printing will be available this session
 */
export async function createReportSession(username, password) {
  const ATTEMPTS = 3;
  const RETRY_DELAY_MS = 750;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch('/api/auth/report-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });
      if (response.ok) return true;
    } catch {
      // Network blip — fall through to retry below like a thrown error would.
    }
    if (attempt < ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return false;
}

/** Tears down the report cookie session. Best-effort, never throws. */
export async function destroyReportSession() {
  try {
    await fetch('/api/auth/report-session', { method: 'DELETE' });
  } catch { /* signing out locally matters more than the server-side sweep */ }
}

/**
 * Obtains a new access token using a valid refresh token.
 * NOTE: not currently called anywhere — the actual token refresh on 401 is
 * handled inline in src/lib/axios/interceptors.js, which duplicates this logic.
 * @param {string} refreshToken
 * @returns {Promise<{ access_token, refresh_token, expires_in, token_type }>}
 */
export async function refreshToken(refreshToken) {
  const params = new URLSearchParams();
  params.append('grant_type', APP_CONFIG.AUTH.GRANT_TYPE_REFRESH);
  params.append('refresh_token', refreshToken);
  params.append('client_id', APP_CONFIG.AUTH.CLIENT_ID);

  const response = await axiosInstance.post(API.AUTH.REFRESH_TOKEN, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipAuth: true,
  });

  return response.data;
}