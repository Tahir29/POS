'use client';

// src/components/shared/StarRating/index.jsx
// Five-star rating display with partial-fill support (e.g. 4.3 → 4 full
// stars + a 30%-filled 5th) — no half-star icon asset needed, each star is
// an outline icon with a clipped filled icon layered on top.

import { Star } from 'lucide-react';

const SIZES = {
  sm: 12,
  md: 14,
  lg: 18,
};

/**
 * @param {{
 *   rating:      number,       // 0–5
 *   count?:      number,       // review count — shown as "(count)" when provided
 *   size?:       'sm' | 'md' | 'lg',
 *   showValue?:  boolean,      // show the numeric rating (e.g. "4.3") before the count
 *   className?:  string,
 * }} props
 */
export default function StarRating({ rating = 0, count, size = 'sm', showValue = false, className = '' }) {
  const px = SIZES[size] ?? SIZES.sm;
  const clamped = Math.min(5, Math.max(0, rating));

  return (
    <div className={`flex items-center gap-1 ${className}`} aria-label={`${clamped} out of 5 stars`}>

      {/* Compact — below sm: single star + numeric value + count, no room for 5 icons */}
      <div className="flex items-center gap-1 sm:hidden">
        <Star size={px} className="text-amber-400 fill-amber-400 shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-stone-700">{clamped.toFixed(1)}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="text-xs text-muted-foreground">({count.toLocaleString('en-IN')})</span>
        )}
      </div>

      {/* Full — sm and up: 5-star partial-fill row */}
      <div className="hidden sm:flex items-center gap-1">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => {
            const fillPct = Math.round(Math.min(1, Math.max(0, clamped - i)) * 100);
            return (
              <span key={i} className="relative inline-block" style={{ width: px, height: px }}>
                <Star size={px} className="absolute inset-0 text-stone-300" aria-hidden="true" />
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPct}%` }}
                >
                  <Star size={px} className="text-amber-400 fill-amber-400" aria-hidden="true" />
                </span>
              </span>
            );
          })}
        </div>
        {showValue && clamped > 0 && (
          <span className="text-xs font-semibold text-stone-700">{clamped.toFixed(1)}</span>
        )}
        {typeof count === 'number' && count > 0 && (
          <span className="text-xs text-muted-foreground">({count.toLocaleString('en-IN')})</span>
        )}
      </div>
    </div>
  );
}
