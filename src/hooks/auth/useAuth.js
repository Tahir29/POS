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

import { generateToken, createReportSession, destroyReportSession } from '@/services/authService';
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
import { clearRecentlyViewed } from '@/store/slices/recentlyViewedSlice';
import { clearWishlist } from '@/store/slices/wishlistSlice';
import { persistor } from '@/store';
import { clearAllCookies } from '@/lib/cookies';
import queryClient from '@/lib/queryClient';

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

    // Also establish the OrnaVerse cookie session that invoice printing
    // needs — /Print/Render ignores the bearer token above. Deliberately not
    // awaited into the critical path and it cannot throw: if it fails, the
    // POS works normally and only printing is unavailable until next sign-in.
    createReportSession(username, password);

    dispatch(
      setTokens({
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn:    tokenData.expires_in,
        username,
      })
    );

    // Store context is session-specific — never trust a store id persisted
    // from a previous login. Without this, a stale activeStoreId survives
    // in localStorage (store is in the persist whitelist) and passes
    // StoreGuard's truthy check, so every store-scoped call (Order/List,
    // BuyBack/List, Exchange/List, Return/List, ...) gets sent with an
    // invalid company_id and the API rejects them with 400 — until the
    // user manually clears site data. Reset here so it's always re-derived
    // from this login's GetUserStores response.
    dispatch(clearStore());

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
    // Drop the operator's OrnaVerse cookie session server-side too, so
    // signing out actually ends it rather than leaving it to age out.
    destroyReportSession();

    if (tracker.isSessionActive()) {
      tracker.endSession('agent_logout');
    }

    tracker.trackAgent(EVENTS.AGENT_LOGOUT, {
      timestamp: new Date().toISOString(),
    });

    dispatch(clearAuth());
    dispatch(clearStore());
    // reason: 'session_reset' — see abandonedCartMiddleware's cart/clearCart
    // case. This is the OPERATOR's session ending, not the customer's cart
    // being resolved — a customer who still has an unpaid cart at logout
    // should have it PRESERVED as abandoned, not deleted, which is what the
    // default (no reason) clearCart() means everywhere else it's called.
    dispatch(clearCart({ reason: 'session_reset' }));
    // FIXED 2026-08-22: recentlyViewed isn't in persistConfig's whitelist
    // (see that slice's own header comment), so it was never written to
    // localStorage — but it's still a live, in-memory Redux slice, and
    // nothing was clearing IT on logout. clearCart() resets cart via the
    // 'cart/clearCart' action type, which recentlyViewedMiddleware doesn't
    // listen for (only 'cart/attachCustomer'/'cart/detachCustomer' do) — so
    // on a shared terminal, a new agent signing in right after — without a
    // full page reload — could see the PREVIOUS customer's recently-viewed
    // carousel until a fresh attach/detach cycle overwrote it. Dispatched
    // directly here rather than teaching the middleware about 'clearCart',
    // since logout is a one-off case, not something every clearCart caller
    // should imply.
    dispatch(clearRecentlyViewed());
    // Same reasoning as clearRecentlyViewed — wishlist isn't in
    // persistConfig's whitelist either (see wishlistSlice's header
    // comment), and wishlistMiddleware only listens for
    // cart/attachCustomer/detachCustomer, not cart/clearCart, so nothing
    // else resets this slice on logout.
    dispatch(clearWishlist());
    // No separate dispatch(clearAbandonedCartState()) needed here, unlike
    // recentlyViewed above — abandonedCartMiddleware's own cart/clearCart
    // case (triggered by the 'session_reset' dispatch above) already resets
    // this slice unconditionally, regardless of the reason. It only decided
    // whether to SAVE or DELETE the Mongo record based on that reason; the
    // local Redux reset happens either way.
    // Any cookie the backend may have set (e.g. a load-balancer/session
    // cookie) must not outlive the session it belongs to — previously only
    // the dev-only "clear site data" button did this, so a stale cookie
    // could persist across normal logins indefinitely.
    clearAllCookies();
    // The dispatches above wipe Redux (and, for the persisted slices, their
    // localStorage mirror) by resetting each slice back to its initial
    // state — but that still WRITES an (empty) object to localStorage
    // rather than removing the entry outright. persistor.purge() (2026-08-22)
    // is redux-persist's own API for actually deleting the persisted entry,
    // which is what "cleared entirely" should mean on a full sign-out —
    // belt-and-braces alongside the resets above, not a replacement for them
    // (the resets still matter for the in-memory state other components are
    // already subscribed to).
    persistor.purge();
    // FIXED 2026-08-22: this used to run BEFORE the dispatches above —
    // dispatch(clearCart()) is caught by analyticsMiddleware's own
    // 'cart/clearCart' case, which calls tracker.track(EVENTS.CART_CLEARED),
    // and track() unconditionally re-writes sessionStorage's events key. So
    // clearing the tracker first just meant a fresh "cart cleared" event got
    // written right back into it a moment later — sessionStorage was never
    // actually empty after logout, confirmed live. Now the last thing to
    // touch it, after every dispatch that could trigger a tracked event.
    tracker.clear();
    // TanStack Query's cache is a separate, module-level singleton (see
    // lib/queryClient.js) that nothing above was ever clearing on logout.
    // On a shared terminal, a different agent logging in right after —
    // without a full page reload — would inherit every previously-cached
    // query still sitting in memory: schemes list, payment modes, sales
    // persons, financial year/document config, catalog prices, etc. Several
    // of those aren't even keyed by store id, so they wouldn't self-correct
    // just because the new agent picks a different store. Clearing here
    // guarantees the next agent starts from a genuinely empty cache.
    queryClient.clear();
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