'use client';

// Wraps AppShell's <main> content so every route change gets the same
// fade/rise transition instead of an abrupt swap.
// initial={false} skips animating the first paint (hard refresh / redirect);
// mode="wait" avoids double-rendering two pages' data-fetching during a swap.

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
