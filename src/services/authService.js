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
 * NEVER let this reject into the login flow: printing is the only thing that
 * depends on it, and a POS that won't open because a report session failed is
 * far worse than one that can't print until the next sign-in.
 *
 * @returns {Promise<boolean>} whether printing will be available this session
 */
export async function createReportSession(username, password) {
  try {
    const response = await fetch('/api/auth/report-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    return response.ok;
  } catch {
    return false;
  }
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