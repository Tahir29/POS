'use client';

import { useSelector } from 'react-redux';
import { Gem } from 'lucide-react';
import { selectGlobalLoading } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';

/**
 * PageLoader — full-screen loading overlay.
 *
 * Two usage modes:
 *   1. Controlled via Redux: reads globalLoading from uiSlice automatically.
 *   2. Forced via prop: pass force={true} to show regardless of Redux state.
 *      Used by AuthGuard and StoreGuard during their redirect checks.
 *
 * @param {{ force?: boolean, label?: string }} props
 */
export default function PageLoader({ force = false, label = 'Loading…' }) {
  const globalLoading = useSelector(selectGlobalLoading);
  const visible = force || globalLoading;

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4',
        'bg-background/80 backdrop-blur-sm'
      )}
    >
      <Gem
        size={36}
        className="text-primary animate-pulse"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground tracking-wide">{label}</p>
    </div>
  );
}