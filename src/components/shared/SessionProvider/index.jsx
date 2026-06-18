'use client';

// src/components/shared/SessionProvider/index.jsx
//
// Customer-centric session tracking.
// - Idle timer ONLY runs when a customer is attached (customerId in cart).
// - Idle timeout detaches the customer, does NOT log out the agent.
// - Redirects to /dashboard on idle timeout.
// - Tracks page views + clicks only during an active customer session.

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';

import { selectCartCustomerId }  from '@/store/slices/cartSlice';
import { selectIsAuthenticated } from '@/store/slices/authSlice';
import { detachCustomer, clearCart } from '@/store/slices/cartSlice';

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

  const isAuthenticated = useSelector(selectIsAuthenticated);
  const customerId      = useSelector(selectCartCustomerId);
  const isCustomerActive = isAuthenticated && !!customerId;

  const idleTimerRef     = useRef(null);
  const warningTimerRef  = useRef(null);
  const clickDebounceRef = useRef(null);
  const lastPathRef      = useRef(null);

  // ── Idle timer — only when customer is attached ───────────────────────────
  const clearIdleTimers = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(warningTimerRef.current);
    idleTimerRef.current    = null;
    warningTimerRef.current = null;
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!isCustomerActive) return;
    clearIdleTimers();

    // Warning at 14 min
    warningTimerRef.current = setTimeout(() => {
      toast.warn('Customer session expiring in 1 minute due to inactivity.', {
        autoClose: 10000,
        toastId:   'idle-warning',
      });
    }, APP_CONFIG.SESSION.IDLE_TIMEOUT_MS - APP_CONFIG.SESSION.WARNING_BEFORE);

    // Customer auto-logout at 15 min — agent stays logged in
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

  // Start/stop idle timer based on customer presence
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

  // ── Page view tracking — only during customer session ─────────────────────
  useEffect(() => {
    if (!isCustomerActive) return;
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    tracker.track(EVENTS.PAGE_VIEW, {
      path:  pathname,
      title: typeof document !== 'undefined' ? document.title : '',
    });
  }, [pathname, isCustomerActive]);

  // Reset path ref when customer detaches so next customer gets fresh tracking
  useEffect(() => {
    if (!isCustomerActive) {
      lastPathRef.current = null;
    }
  }, [isCustomerActive]);

  // ── Click tracking — only during customer session ─────────────────────────
  useEffect(() => {
    if (!isCustomerActive) return;

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
  }, [isCustomerActive, pathname]);

  return children;
}