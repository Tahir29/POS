// src/hooks/ui/useBodyScrollLock.js
//
// Locks background scroll while `isOpen` is true — shared by every
// sheet/modal in the app that needs this (BottomSheet, ProductImageZoomModal)
// so the fix below lives in exactly one place instead of drifting across
// hand-rolled copies.
//
// FIXED 2026-09-08 — the naive version of this (seen in both of the above
// before this hook existed: `document.body.style.overflow = isOpen ?
// 'hidden' : ''`) removes the page's vertical scrollbar the instant it
// fires. With nothing compensating for the width that scrollbar used to
// occupy, the browser's available content width grows by the scrollbar's
// own width — every normal-flow element on the page (the header, the cart
// icon inside it, since Header is a regular shrink-0 flex child, not
// position:fixed) reflows wider to fill it, visibly shifting sideways the
// instant a sheet opens, then shifting back the instant it closes. A
// `scrollbar-gutter: stable` rule on <html> was tried first (see
// globals.css's git history) and didn't help: that property only takes
// effect on an element whose COMPUTED overflow isn't 'visible', and body's
// default overflow value already IS 'visible' until this same JS sets it —
// so the reservation never actually activated.
//
// This measures the real scrollbar width (window.innerWidth -
// document.documentElement.clientWidth, taken BEFORE hiding it) and adds
// that back as body padding-right for as long as scroll stays locked — the
// same compensation technique Radix's own Dialog primitive uses
// internally for exactly this. Captures whatever overflow/paddingRight
// were already set before overwriting them, and restores those exact
// values (not blindly ''/'0') on cleanup — this composes correctly if two
// locks are ever nested (e.g. a confirm dialog opened from inside an
// already-open sheet), each restoring the state it found, not clobbering
// the outer lock's own values.
import { useEffect } from 'react';

export function useBodyScrollLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);
}
