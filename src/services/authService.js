import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

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
  params.append('grant_type', 'password');
  params.append('client_id', 'api_access');
  params.append('scope', 'openid offline_access');

  const response = await axiosInstance.post(API.AUTH.GENERATE_TOKEN, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // Skip the request interceptor token attachment for this call —
    // it is a public endpoint and has no Bearer token yet.
    _skipAuth: true,
  });

  return response.data;
}

/**
 * Obtains a new access token using a valid refresh token.
 * Called automatically by the Axios response interceptor — not called directly by components.
 * @param {string} refreshToken
 * @returns {Promise<{ access_token, refresh_token, expires_in, token_type }>}
 */
export async function refreshToken(refreshToken) {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);
  params.append('client_id', 'api_access');

  const response = await axiosInstance.post(API.AUTH.REFRESH_TOKEN, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    _skipAuth: true,
  });

  return response.data;
}