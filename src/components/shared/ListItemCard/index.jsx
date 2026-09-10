'use client';

// Shared tappable list-item card shell (outer button, optional header +
// dashed divider, meta-row container, optional footer) used by
// OrderListItem, InvoiceListItem, and CustomerListItem — each caller still
// owns its own row content.
//
// `itemVariants` uses the same "hidden"/"show" keys as StaggerList's
// container variants, so a card wrapped in <StaggerList> cascades in
// automatically via Motion's variant propagation; used standalone, the
// variants are simply never triggered (hover/tap still work).

import { motion, useReducedMotion } from 'motion/react';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.standard, ease: EASE_PREMIUM } },
};

export default function ListItemCard({ onSelect, header, footer, children }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-border bg-card text-left hover:border-primary/40 hover:shadow-md transition-all duration-standard ease-premium overflow-hidden"
      variants={reduceMotion ? undefined : itemVariants}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
    >
      {header && (
        <>
          <div className="px-4 pt-4 pb-3">
            <p className="text-[15px] font-semibold text-foreground tracking-tight">
              {header}
            </p>
          </div>
          <div className="mx-4 border-t border-dashed border-border" />
        </>
      )}

      <div className="px-4 py-3 space-y-2">
        {children}
      </div>

      {footer && (
        <div className="flex items-center justify-between px-4 pb-4">
          {footer}
        </div>
      )}
    </motion.button>
  );
}
