'use client';

// src/components/shared/BottomSheet/index.jsx
//
// Reusable bottom sheet / side sheet primitive.
// Used by: SizeSelector (Phase 7), CartDrawer (Phase 8), and any future overlay.
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

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-md',
}) {
  const sheetRef = useRef(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Focus trap: return focus to trigger on close
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200"
      />

      {/* ── Sheet panel ────────────────────────────────────────────────── */}
      {/*
        Mobile  (< md): slides up from the bottom, full width, max 85vh
        Tablet  (md+) : slides in from the right, full height, capped width
      */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`
          fixed z-50 bg-white shadow-2xl flex flex-col
          outline-none

          /* Mobile — bottom sheet */
          bottom-0 left-0 right-0
          rounded-t-2xl max-h-[85vh]
          translate-y-0

          /* Tablet — side sheet */
          md:bottom-0 md:top-0 md:left-auto md:right-0
          md:rounded-none md:rounded-l-2xl
          md:h-full md:max-h-full md:w-full ${maxWidth}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100 shrink-0">
          <h2 className="text-base font-bold text-stone-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="
              min-w-[44px] min-h-[44px] flex items-center justify-center
              rounded-full text-stone-400
              hover:text-stone-700 hover:bg-stone-100
              transition-colors
            "
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Sticky footer (optional) */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-stone-100">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
