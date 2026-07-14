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