'use client';

// src/components/shared/ListItemCard/index.jsx
//
// Shared tappable list-item card shell — the outer button, optional header +
// dashed divider, meta-row container, and optional footer were byte-identical
// (or near-identical) across OrderListItem, InvoiceListItem, and
// CustomerListItem. Each caller still owns its own row content (different
// fields, different icons) — this only extracts the structural wrapper.
//
// PREMIUM REVAMP (2026-07-22) — fixed two hardcoded Tailwind colors
// (text-stone-800, border-stone-200) that had drifted from this app's own
// semantic-token convention (every other shared component uses
// text-foreground/border-border). Also added a real hover/tap lift via
// Framer Motion — this is one of the most-repeated interactive surfaces in
// the app (Orders/Invoices/Customers/Catalog lists), so it's a deliberate
// Motion candidate per the phase-1 plan (unlike Button, which stays plain
// CSS to avoid forcing a client boundary on every action in the app).

import { motion, useReducedMotion } from 'motion/react';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

export default function ListItemCard({ onSelect, header, footer, children }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-border bg-card text-left hover:border-primary/40 hover:shadow-md transition-all duration-standard ease-premium overflow-hidden"
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
