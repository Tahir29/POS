// Locks background scroll while `isOpen` is true — shared by every
// sheet/modal that needs this (BottomSheet, ProductImageZoomModal).
// Compensates for the disappearing scrollbar by adding its width back as
// body padding-right (same technique Radix Dialog uses), and restores
// whatever overflow/paddingRight were already set, so nested locks compose
// correctly instead of clobbering each other on cleanup.
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
