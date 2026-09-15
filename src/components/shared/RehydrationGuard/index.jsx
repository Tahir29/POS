'use client';
// Mounts once at the root of the app (inside <Providers>). Pure side-effect
// component, renders nothing. Runs one security check:
//   SEC-006 — after 15 min idle with a customer attached, detaches the
//             customer and redirects to /dashboard (does not log out the agent).
//
// Used to also run a SEC-002 check (clear auth if Redux Persist restored an
// already-expired token) — that no longer applies since the 2026-09 auth
// rewire: there's no token to expire client-side any more, just an httpOnly
// session cookie the server itself rejects when it's gone (interceptors.js's
// 401 handling covers that).

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { detachCustomer, selectCartCustomerId } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';

// 15 minutes — falls back if APP_CONFIG.SESSION is not yet defined
const IDLE_MS = APP_CONFIG?.SESSION?.IDLE_TIMEOUT_MS ?? 15 * 60 * 1000;

const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function RehydrationGuard() {
  const dispatch         = useDispatch();
  const router           = useRouter();
  const isAuthenticated  = useSelector(selectIsAuthenticated);
  const cartCustomerId   = useSelector(selectCartCustomerId);

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