'use client';
// Mounts once at the root of the app (inside <Providers>). Pure side-effect
// component, renders nothing. Runs two security checks:
//   SEC-002 — clears auth if Redux Persist restored an already-expired token.
//   SEC-006 — after 15 min idle with a customer attached, detaches the
//             customer and redirects to /dashboard (does not log out the agent).

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