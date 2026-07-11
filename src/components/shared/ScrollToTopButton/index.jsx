'use client';

// src/components/shared/ScrollToTopButton/index.jsx
// Floating scroll-to-top button shown only on configured pages
// (see src/constants/scrollToTopConfig.js).
//
// Behavior:
//   - Hidden while near the top of the page (nothing to scroll to).
//   - Once scrolled down past a threshold, the button hides while the
//     user scrolls DOWN and reveals as soon as they scroll UP — a
//     common "appears on upward intent" pattern so it doesn't block
//     content while reading down a long list, but is available the
//     moment the user starts heading back.
//   - Clicking smoothly scrolls the active scroll container back to top.
//
// SCROLL CONTAINER: most pages scroll via AppShell's #main-content, but
// some (e.g. /catalog) render their own nested `overflow-y-auto` panel
// that does the actual scrolling while #main-content stays static.
// getScrollContainer() picks #main-content if it's scrollable, otherwise
// finds the first scrollable descendant.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { isScrollToTopEnabled } from '@/constants/scrollToTopConfig';

const SHOW_AFTER_PX = 200; // minimum scroll distance before the button can appear

function isScrollable(el) {
  return !!el && el.scrollHeight > el.clientHeight + 1;
}

/**
 * Finds the element that's actually scrolling for the current page.
 * Prefers #main-content; falls back to the first scrollable descendant
 * with overflow-y auto/scroll (e.g. /catalog's internal panel).
 */
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
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    let container = getScrollContainer();
    if (!container) return;

    // Reset on route change
    lastScrollTopRef.current = container.scrollTop;
    setIsVisible(false);

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

    // Content (and its scroll container) may render after this effect
    // runs on route change — re-resolve once shortly after mount in
    // case the real scrollable element wasn't ready yet.
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
        fixed bottom-30 right-4 z-99 md:right-10
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