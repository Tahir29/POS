// src/hooks/auth/useAuth.js
// Authentication — login, logout, store selection post-login.
//
// CHANGED: getSettings() removed — AppSettings endpoint does not exist
// in the new API spec. Replaced with checkMetalRateToday() which warns
// the operator if metal rates haven't been set for the day.

import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'react-toastify';

import { generateToken }       from '@/services/authService';
import { getUserStores }       from '@/services/storeService';
import { checkMetalRateToday } from '@/services/settingsService';

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

import TOAST   from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS  from '@/lib/analytics/events';

export function useAuth() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user            = useSelector(selectAuthUser);
  const accessToken     = useSelector(selectAccessToken);

  const login = useCallback(async (username, password) => {
    const tokenData = await generateToken(username, password);

    dispatch(
      setTokens({
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn:    tokenData.expires_in,
        username,
      })
    );

    const storesData = await getUserStores();
    const stores = Array.isArray(storesData)
      ? storesData
      : storesData?.Entities ?? storesData?.data ?? storesData?.result ?? [];

    dispatch(setAvailableStores(stores));

    // Non-blocking startup check — warn if metal rates not set for today.
    // Failure is silently swallowed so it never blocks login.
    try {
      const rateCheck = await checkMetalRateToday();
      const ratesSet  = rateCheck?.is_set ?? rateCheck?.Entity?.is_set ?? true;
      if (!ratesSet) {
        toast.warn(TOAST.METAL_RATES.NOT_SET);
      }
    } catch {
      // Network or auth issue — don't block login
    }

    if (stores.length === 1) {
      const store = stores[0];
      dispatch(
        setActiveStore({
          storeId:   store.company_id,
          storeName: store.mailing_name,  // mailing_name — no company_name field
          storeCode: store.company_code ?? null,
        })
      );

      tracker.trackAgent(EVENTS.AGENT_LOGIN, {
        username,
        storeId:   store.company_id,
        storeName: store.mailing_name,
        timestamp: new Date().toISOString(),
      });

      toast.success(TOAST.AUTH.LOGIN_SUCCESS);
      router.replace('/dashboard');
    } else {
      tracker.trackAgent(EVENTS.AGENT_LOGIN, {
        username,
        storeCount: stores.length,
        timestamp:  new Date().toISOString(),
      });

      toast.success(TOAST.AUTH.LOGIN_SUCCESS);
      router.replace('/store-selection');
    }
  }, [dispatch, router]);

  const logout = useCallback(() => {
    if (tracker.isSessionActive()) {
      tracker.endSession('agent_logout');
    }

    tracker.trackAgent(EVENTS.AGENT_LOGOUT, {
      timestamp: new Date().toISOString(),
    });

    tracker.clear();

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