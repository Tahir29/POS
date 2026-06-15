'use client';

import { useState, useEffect } from 'react';
import { Store, Clock } from 'lucide-react';

import { useActiveStore } from '@/hooks/store/useActiveStore';

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Returns a formatted date string: "Monday, 9 June 2026"
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

/**
 * Returns a formatted 12-hour time string: "10:42:05 AM"
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// ── COMPONENT ─────────────────────────────────────────────────

/**
 * StoreClockHeader
 *
 * Displays the active store name alongside a live date and time.
 * The clock ticks every second via a setInterval — interval is
 * cleaned up on unmount to prevent memory leaks.
 *
 * Reads activeStoreName from Redux storeSlice via useActiveStore.
 * No API calls — purely presentational + Redux read.
 */
export default function StoreClockHeader() {
  const { activeStoreName } = useActiveStore();
  const [now, setNow] = useState(() => new Date());

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

      {/* Store name */}
      <div className="flex items-center gap-2">
        <Store
          size={18}
          className="text-muted-foreground shrink-0"
          aria-hidden="true"
        />
        <h1 className="text-xl font-semibold tracking-tight truncate">
          {activeStoreName ?? 'Lucira POS'}
        </h1>
      </div>

      {/* Date + live time */}
      <div
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
        aria-label={`Current date and time: ${formatDate(now)}, ${formatTime(now)}`}
        aria-live="off"
      >
        <Clock size={14} className="shrink-0" aria-hidden="true" />
        <span>{formatDate(now)}</span>
        <span className="text-border" aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">{formatTime(now)}</span>
      </div>

    </div>
  );
}
