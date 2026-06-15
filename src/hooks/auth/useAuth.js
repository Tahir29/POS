import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'react-toastify';

import { generateToken } from '@/services/authService';
import { getUserStores } from '@/services/storeService';
import { getSettings } from '@/services/settingsService';

import {
  setTokens,
  clearAuth,
  selectIsAuthenticated,
  selectAuthUser,
  selectAccessToken,
} from '@/store/slices/authSlice';

import {
  setAvailableStores,
  setActiveStore,
  clearStore,
} from '@/store/slices/storeSlice';

import { clearCart } from '@/store/slices/cartSlice';

import TOAST from '@/constants/toastMessages'

/**
 * useAuth — central hook for authentication state and actions.
 *
 * Provides:
 *   - isAuthenticated: boolean
 *   - user: { username } | null
 *   - accessToken: string | null
 *   - login(username, password): async — authenticates, fetches stores, routes accordingly
 *   - logout(): clears auth + store slices, redirects to /login
 */
export function useAuth() {
  const dispatch = useDispatch();
  const router = useRouter();

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectAuthUser);
  const accessToken = useSelector(selectAccessToken);

  /**
   * Authenticates the user, fetches their accessible stores,
   * and routes them to store selection or directly to the dashboard.
   */
  const login = useCallback(async (username, password) => {
    // 1. Generate token
    const tokenData = await generateToken(username, password);

    dispatch(
      setTokens({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        username,
      })
    );

    // 2. Fetch accessible stores
    const storesData = await getUserStores();    

    // OrnaVerse wraps list responses — extract the array defensively
    const stores = Array.isArray(storesData)
      ? storesData
      : storesData?.Entities ?? storesData?.data ?? storesData?.result ?? [];

    dispatch(setAvailableStores(stores));

    // 3. Fetch app settings (fire and ignore errors — non-blocking)
    try {
      await getSettings();
    } catch {
      // Settings failure does not block login
    }

    // 4. Route based on store count
    if (stores.length === 1) {
      dispatch(
        setActiveStore({
          storeId: stores[0].company_id,
          storeName: stores[0].mailing_name,
          storeCode: stores[0].company_code ?? null,
        })
      );
      toast.success(TOAST.AUTH.LOGIN_SUCCESS);
      router.replace('/dashboard');
    } else {
      toast.success(TOAST.AUTH.LOGIN_SUCCESS);
      router.replace('/store-selection');
    }
  }, [dispatch, router]);

  

  /**
   * Logs the user out.
   * Clears auth and store slices. Cart is intentionally preserved for session resumption.
   * Redirects to /login.
   */
  const logout = useCallback(() => {
    dispatch(clearAuth());
    dispatch(clearStore());
    dispatch(clearCart());
    toast.info(TOAST.AUTH.LOGOUT_SUCCESS);
    router.replace('/login');
  }, [dispatch, router]);

  return {
    isAuthenticated,
    user,
    accessToken,
    login,
    logout,
  };
}