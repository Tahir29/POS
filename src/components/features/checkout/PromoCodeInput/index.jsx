'use client';

// src/components/features/checkout/PromoCodeInput/index.jsx
// Code entry with "Apply" button — validates via usePromoValidation.

import { useState } from 'react';
import { Loader2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   onApply: (code: string) => void,
 *   isValidating?: boolean,
 * }} props
 */
export default function PromoCodeInput({ onApply, isValidating }) {
  const [code, setCode] = useState('');

  const handleApply = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || isValidating) return;
    onApply(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
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
          disabled={isValidating}
          className="h-11 pl-9 uppercase"
        />
      </div>
      <Button
        type="button"
        onClick={handleApply}
        disabled={!code.trim() || isValidating}
        className="h-11 min-w-[88px]"
      >
        {isValidating ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          'Apply'
        )}
      </Button>
    </div>
  );
}