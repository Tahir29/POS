'use client';

// Code entry with "Apply" button — validates via usePromoValidation.

import { useState } from 'react';
import { Loader2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   onApply: (code: string) => void,
 *   isValidating?: boolean,
 *   disabled?: boolean,
 *   disabledHint?: string,
 * }} props
 *   disabled/disabledHint (2026-08-24) — checkout can't check a code's real
 *   eligibility until this basket has finished pricing (see
 *   usePromoValidation), so the whole point of checking BEFORE applying
 *   falls apart if Apply is still clickable in that window. Disabled here,
 *   not just left to fail with a toast after the click.
 */
export default function PromoCodeInput({ onApply, isValidating, disabled = false, disabledHint }) {
  const [code, setCode] = useState('');

  const isDisabled = disabled || isValidating;

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || isDisabled) return;
    onApply(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Tag
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            placeholder="Enter promo code"
            aria-label="Promo code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            className="h-11 pl-9 uppercase"
          />
        </div>
        <Button
          type="button"
          onClick={handleApply}
          disabled={!code.trim() || isDisabled}
          className="h-11 min-w-[88px]"
        >
          {isValidating ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            'Apply'
          )}
        </Button>
      </div>
      {disabled && disabledHint && (
        <p className="px-1 text-xs text-muted-foreground">{disabledHint}</p>
      )}
    </div>
  );
}