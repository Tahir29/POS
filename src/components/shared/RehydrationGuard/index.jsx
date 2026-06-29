'use client';
// src/components/shared/RehydrationGuard/index.jsx
//
// Mounts once at the root of the app (inside <Providers>, therefore inside Redux).
// Runs two security checks on every page load:
//
//   SEC-002 — Token expiry on rehydration
//             Redux Persist can restore a token that expired while the tab was
//             closed. We check tokenExpiry immediately after mount and dispatch
//             clearAuth() if it has already passed.
//
//   SEC-006 — Idle timeout
//             After a customer is attached to the cart, a 15-minute inactivity
//             timer runs. On expiry the customer is detached (detachCustomer)
//             and the agent is redirected to /dashboard. Agent is NOT logged out.
//
// This component renders nothing — it is a pure side-effect mount.

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { clearAuth, selectTokenExpiry, selectIsAuthenticated } from '@/store/slices/authSlice';
import { detachCustomer, selectCartCustomerId } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';

// 15 minutes — falls back if APP_CONFIG.SESSION is not yet defined
const IDLE_MS = APP_CONFIG?.SESSION?.IDLE_TIMEOUT_MS ?? 15 * 60 * 1000;

const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function RehydrationGuard() {
  const dispatch         = useDispatch();
  const router           = useRouter();
  const tokenExpiry      = useSelector(selectTokenExpiry);
  const isAuthenticated  = useSelector(selectIsAuthenticated);
  const cartCustomerId   = useSelector(selectCartCustomerId);

  // ── SEC-002: Token expiry check on rehydration ────────────────
  // Runs once on mount. If persisted token is already expired, clear auth
  // immediately so middleware redirects to /login before any page renders.
  useEffect(() => {
    if (isAuthenticated && tokenExpiry && Date.now() > tokenExpiry) {
      dispatch(clearAuth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only

  // ── SEC-006: Idle timeout ─────────────────────────────────────
  const timerRef = useRef(null);

  const handleIdleTimeout = useCallback(() => {
    // Detach customer only — do NOT log the agent out (shared device model)
    dispatch(detachCustomer());
    router.push('/dashboard');
  }, [dispatch, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleIdleTimeout, IDLE_MS);
  }, [handleIdleTimeout]);

  useEffect(() => {
    // Only run the idle timer when a customer is actively attached.
    if (!isAuthenticated || !cartCustomerId) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    resetTimer();
    IDLE_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      IDLE_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isAuthenticated, cartCustomerId, resetTimer]);

  return null;
}