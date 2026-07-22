'use client';

// src/components/shared/BottomSheet/index.jsx
//
// Reusable bottom sheet / side sheet primitive.
//
// On tablet (md+): renders as a right-side drawer (side sheet).
// On mobile     : renders as a bottom sheet.
//
// Props:
//   isOpen    boolean        — controlled open state
//   onClose   () => void     — close handler
//   title     string         — sheet header title
//   children  ReactNode      — sheet body content
//   footer    ReactNode?     — optional sticky footer (confirm buttons, CTAs)
//   maxWidth  string?        — Tailwind max-w class for side sheet (default: 'max-w-md')
//
// BUG 5 FIX — replaced all hardcoded colors (bg-white, stone-*) with
// semantic CSS design tokens (bg-card, border-border, text-foreground, etc.)
// so the sheet respects the Lucira theme and any future dark-mode changes.
//
// PREMIUM REVAMP (2026-07-22) — was a hard `if (!isOpen) return null`
// mount/unmount with no exit animation; now uses Framer Motion's
// AnimatePresence so the panel actually slides+fades in and out. The panel
// slides on the axis matching whichever responsive layout is active
// (y on mobile, x on tablet+) via useMediaQuery, since a single fixed axis
// would be wrong for one of the two breakpoints. Props API is unchanged —
// every existing consumer works with zero changes.

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/ui/useMediaQuery';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-md',
}) {
  const sheetRef = useRef(null);
  const isDesktop = useMediaQuery('(min-width: 768px)'); // matches the md: breakpoint below
  const reduceMotion = useReducedMotion();

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Move focus into the sheet when it opens
  useEffect(() => {
    if (isOpen && sheetRef.current) sheetRef.current.focus();
  }, [isOpen]);

  const offAxis = isDesktop ? { x: '100%' } : { y: '100%' };
  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, ...offAxis },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 0, ...offAxis },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ───────────────────────────────────────────────── */}
          <motion.div
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.standard }}
          />

          {/* ── Sheet panel ────────────────────────────────────────────── */}
          {/*
            Mobile  (< md): slides up from the bottom, full width, max 85vh
            Tablet  (md+) : slides in from the right, full height, capped width
          */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={`
              fixed z-50 shadow-2xl flex flex-col outline-none
              bg-card

              /* Mobile — bottom sheet */
              bottom-0 left-0 right-0
              rounded-t-2xl max-h-[85vh]

              /* Tablet — side sheet */
              md:bottom-0 md:top-0 md:left-auto md:right-0
              md:rounded-none md:rounded-l-2xl
              md:h-full md:max-h-full md:w-full ${maxWidth}
            `}
            {...panelMotion}
            transition={{ duration: DURATION.panel, ease: EASE_PREMIUM }}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
              <h2
                className="text-base font-bold text-foreground"
                style={{ fontFamily: 'var(--font-abhaya)' }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="
                  min-w-[44px] min-h-[44px] flex items-center justify-center
                  rounded-full text-muted-foreground
                  hover:text-foreground hover:bg-secondary
                  transition-colors duration-standard ease-premium
                "
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {children}
            </div>

            {/* ── Sticky footer (optional) ───────────────────────────── */}
            {footer && (
              <div className="shrink-0 px-5 py-4 border-t border-border">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
