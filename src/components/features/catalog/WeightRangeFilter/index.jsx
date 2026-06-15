'use client';

import { useState, useEffect } from 'react';

/**
 * WeightRangeFilter
 * Renders a min/max numeric input pair for gross weight filtering.
 * Calls onApply(from, to) when both inputs are committed (blur or Enter).
 *
 * Props:
 *   label        — string, e.g. "Gross Weight (g)"
 *   fromValue    — number | null
 *   toValue      — number | null
 *   onApply(from, to) — callback with parsed floats (null if empty)
 */
export default function WeightRangeFilter({ label, fromValue, toValue, onApply }) {
  const [from, setFrom] = useState(fromValue !== null ? String(fromValue) : '');
  const [to, setTo]     = useState(toValue   !== null ? String(toValue)   : '');

  // Keep local state in sync when URL params change externally (e.g. clear filters)
  useEffect(() => {
    setFrom(fromValue !== null ? String(fromValue) : '');
  }, [fromValue]);

  useEffect(() => {
    setTo(toValue !== null ? String(toValue) : '');
  }, [toValue]);

  const commit = () => {
    const parsedFrom = from.trim() !== '' ? parseFloat(from) : null;
    const parsedTo   = to.trim()   !== '' ? parseFloat(to)   : null;
    onApply(parsedFrom, parsedTo);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      commit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="sr-only">Minimum {label}</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Min"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="
              w-full min-h-[44px] px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
              placeholder:text-gray-400
            "
          />
        </div>

        <span className="text-gray-400 text-sm select-none">–</span>

        <div className="flex-1">
          <label className="sr-only">Maximum {label}</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Max"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="
              w-full min-h-[44px] px-3 py-2
              text-sm text-gray-800
              bg-white border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent
              placeholder:text-gray-400
            "
          />
        </div>
      </div>
    </div>
  );
}