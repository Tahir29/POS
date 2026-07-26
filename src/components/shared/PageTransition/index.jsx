'use client';

// src/components/shared/PageTransition/index.jsx
//
// Wraps AppShell's <main> content so every route change gets the same
// quick fade/rise instead of an abrupt swap — the "seamless app" feel
// applied once, globally, rather than reimplemented per page.
//
// initial={false} on AnimatePresence skips animating the very first
// paint (login → dashboard redirect, hard refresh) — only actual
// in-app navigations transition. mode="wait" keeps route swaps from
// double-rendering two pages' data-fetching at once; kept short
// (DURATION.standard, ~200ms) so back-to-back staff navigation still
// feels snappy, not like a marketing-site page load.

import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return children;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: DURATION.standard, ease: EASE_PREMIUM }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
