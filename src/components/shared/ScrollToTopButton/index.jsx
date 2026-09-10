'use client';

// Floating scroll-to-top button shown only on configured pages (see
// src/constants/scrollToTopConfig.js). Hidden near the top; below the
// threshold it hides on scroll-down and reveals on scroll-up.
//
// Most pages scroll via AppShell's #main-content, but some (e.g. /catalog)
// scroll inside their own nested overflow-y-auto panel instead —
// getScrollContainer() picks #main-content if scrollable, else the first
// scrollable descendant.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { isScrollToTopEnabled } from '@/constants/scrollToTopConfig';

const SHOW_AFTER_PX = 200;

function isScrollable(el) {
  return !!el && el.scrollHeight > el.clientHeight + 1;
}

function getScrollContainer() {
  const main = document.getElementById('main-content');
  if (!main) return null;

  if (isScrollable(main)) return main;

  const candidates = main.querySelectorAll('*');
  for (const el of candidates) {
    const style = window.getComputedStyle(el);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && isScrollable(el)) {
      return el;
    }
  }

  return main;
}

export default function ScrollToTopButton() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const lastScrollTopRef = useRef(0);

  const enabled = isScrollToTopEnabled(pathname);

  useEffect(() => {
    // No manual isVisible reset needed here: AppShell renders this with
    // key={pathname}, so a route change remounts it and isVisible starts
    // fresh at false on its own.
    if (!enabled) return;

    let container = getScrollContainer();
    if (!container) return;

    lastScrollTopRef.current = container.scrollTop;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const lastScrollTop = lastScrollTopRef.current;
      const scrollingUp = scrollTop < lastScrollTop;

      if (scrollTop <= SHOW_AFTER_PX) {
        setIsVisible(false);
      } else if (scrollingUp) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }

      lastScrollTopRef.current = scrollTop;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Content may render after this effect runs on route change — re-resolve
    // once shortly after mount in case the real scroll container wasn't ready.
    const retryTimer = setTimeout(() => {
      const resolved = getScrollContainer();
      if (resolved && resolved !== container) {
        container.removeEventListener('scroll', handleScroll);
        container = resolved;
        lastScrollTopRef.current = container.scrollTop;
        container.addEventListener('scroll', handleScroll, { passive: true });
      }
    }, 300);

    return () => {
      clearTimeout(retryTimer);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, pathname]);

  const handleClick = () => {
    const container = getScrollContainer();
    container?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      className={`
        fixed bottom-30 right-4 z-30 md:right-10
        flex h-11 w-11 items-center justify-center rounded-full
        bg-primary text-primary-foreground shadow-lg
        transition-all duration-200
        ${isVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}