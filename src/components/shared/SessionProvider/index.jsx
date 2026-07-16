'use client';

// src/components/shared/SessionProvider/index.jsx
//
// Two independent idle timers:
// - Customer idle timer — runs only when a customer is attached
//   (customerId in cart). Detaches the customer + clears the cart, does
//   NOT log out the agent. Redirects to /dashboard.
// - Staff idle timer — runs whenever the agent is authenticated, regardless
//   of customer state. Fully logs the agent out via useAuth().logout().
// Both timers reset on the same activity events, tracked separately so
// each has its own warning/timeout schedule.
//
// Tracks page views + clicks only during an active customer session.

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';

import { selectCartCustomerId }  from '@/store/slices/cartSlice';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { detachCustomer, clearCart } from '@/store/slices/cartSlice';
import { useAuth } from '@/hooks/auth/useAuth';

import tracker from '@/lib/analytics/tracker';
import EVENTS  from '@/lib/analytics/events';
import APP_CONFIG from '@/constants/appConfig';

const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keydown',
  'scroll', 'touchstart', 'pointerdown', 'click',
];

export default function SessionProvider({ children }) {
  const pathname        = usePathname();
  const router          = useRouter();
  const dispatch        = useDispatch();
  const { logout }      = useAuth();

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const customerId      = useSelector(selectCartCustomerId);
  const isCustomerActive = isAuthenticated && !!customerId;

  const idleTimerRef      = useRef(null);
  const warningTimerRef    = useRef(null);
  const staffIdleTimerRef  = useRef(null);
  const staffWarningTimerRef = useRef(null);
  const clickDebounceRef  = useRef(null);
  const lastPathRef       = useRef(null);

  // ── Customer idle timer — only when a customer is attached ────────────────
  const clearIdleTimers = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    idleTimerRef.current    = null;
    warningTimerRef.current = null;
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!isCustomerActive) return;
    clearIdleTimers();

    // Warning 30s before the customer idle timeout
    warningTimerRef.current = setTimeout(() => {
      toast.warn('Customer session expiring in 30 seconds due to inactivity.', {
        autoClose: 10000,
        toastId:   'idle-warning',
      });
    }, APP_CONFIG.SESSION.IDLE_TIMEOUT_MS - APP_CONFIG.SESSION.WARNING_BEFORE);

    // Customer detached after IDLE_TIMEOUT_MS — agent stays logged in
    idleTimerRef.current = setTimeout(() => {
      toast.dismiss('idle-warning');
      tracker.endSession('idle_timeout');
      dispatch(detachCustomer());
      dispatch(clearCart());
      toast.info('Customer session expired due to inactivity.', {
        toastId: 'idle-expired',
      });
      router.replace('/dashboard');
    }, APP_CONFIG.SESSION.IDLE_TIMEOUT_MS);
  }, [isCustomerActive, clearIdleTimers, dispatch, router]);

  // Start/stop customer idle timer based on customer presence
  useEffect(() => {
    if (!isCustomerActive) {
      clearIdleTimers();
      return;
    }

    resetIdleTimer();

    const handleActivity = () => resetIdleTimer();
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    );

    return () => {
      clearIdleTimers();
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity)
      );
    };
  }, [isCustomerActive, resetIdleTimer, clearIdleTimers]);

  // ── Staff idle timer — runs whenever the agent is logged in, regardless
  // of customer state. Full logout (not just a customer detach). ────────────
  const clearStaffIdleTimers = useCallback(() => {
    clearTimeout(staffIdleTimerRef.current);
    clearTimeout(staffWarningTimerRef.current);
    staffIdleTimerRef.current    = null;
    staffWarningTimerRef.current = null;
  }, []);

  const resetStaffIdleTimer = useCallback(() => {
    if (!isAuthenticated) return;
    clearStaffIdleTimers();

    // Warning 30s before the staff idle timeout
    staffWarningTimerRef.current = setTimeout(() => {
      toast.warn('You will be logged out in 30 seconds due to inactivity.', {
        autoClose: 10000,
        toastId:   'staff-idle-warning',
      });
    }, APP_CONFIG.SESSION.STAFF_IDLE_TIMEOUT_MS - APP_CONFIG.SESSION.WARNING_BEFORE);

    // Full agent logout after STAFF_IDLE_TIMEOUT_MS
    staffIdleTimerRef.current = setTimeout(() => {
      toast.dismiss('staff-idle-warning');
      toast.info('Logged out due to inactivity.', { toastId: 'staff-idle-expired' });
      tracker.trackAgent(EVENTS.AGENT_IDLE_LOGOUT, {
        timeoutMs: APP_CONFIG.SESSION.STAFF_IDLE_TIMEOUT_MS,
      });
      logout();
    }, APP_CONFIG.SESSION.STAFF_IDLE_TIMEOUT_MS);
  }, [isAuthenticated, clearStaffIdleTimers, logout]);

  // Start/stop staff idle timer based on auth state
  useEffect(() => {
    if (!isAuthenticated) {
      clearStaffIdleTimers();
      return;
    }

    resetStaffIdleTimer();

    const handleActivity = () => resetStaffIdleTimer();
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, handleActivity, { passive: true })
    );

    return () => {
      clearStaffIdleTimers();
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity)
      );
    };
  }, [isAuthenticated, resetStaffIdleTimer, clearStaffIdleTimers]);

  // ── Page view tracking — runs from login onward ────────────────────────────
  // Broadened 2026-07-16: was gated on isCustomerActive (only tracked once a
  // customer was attached), which missed all browsing/search activity before
  // that point. Now tracks the full staff session — includes customer
  // context in the payload (via tracker.track reading the session) whenever
  // one happens to be attached, but doesn't require it.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    tracker.track(EVENTS.PAGE_VIEW, {
      path:  pathname,
      title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname, isAuthenticated]);

  // Reset path ref on logout so the next login gets fresh tracking
  useEffect(() => {
    if (!isAuthenticated) {
      lastPathRef.current = null;
    }
  }, [isAuthenticated]);

  // ── Click tracking — runs from login onward (see note above) ──────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleClick = (e) => {
      clearTimeout(clickDebounceRef.current);
      clickDebounceRef.current = setTimeout(() => {
        const target = e.target?.closest(
          'button, a, [role="button"], [role="menuitem"], [role="option"], [role="tab"]'
        );
        if (!target) return;

        tracker.track(EVENTS.CLICK, {
          tag:       target.tagName,
          text:      (target.textContent ?? '').trim().slice(0, 50),
          ariaLabel: target.getAttribute('aria-label') ?? null,
          path:      pathname,
          id:        target.id || null,
        });
      }, APP_CONFIG.SESSION.CLICK_DEBOUNCE);
    };

    document.addEventListener('click', handleClick, { passive: true, capture: true });
    return () => {
      clearTimeout(clickDebounceRef.current);
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [isAuthenticated, pathname]);

  return children;
}