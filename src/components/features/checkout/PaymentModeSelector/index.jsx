'use client';

// src/components/features/checkout/PaymentModeSelector/index.jsx
// List of payment modes as selectable icon tiles. Supports multi-select
// for split payments — selecting a mode adds it to the active payment split;
// deselecting removes it.
//
// Restyled to icon-on-top tiles matching the new checkout design. The
// mode SET itself remains fully data-driven from usePaymentModes (real
// PaymentReceiptMode/List data) — only the icon per tile is a cosmetic
// lookup by mode_code, with a generic fallback for anything unmapped so
// no mode is ever hidden just because it isn't in this icon map.

import { Loader2, CreditCard, Check, Smartphone, Banknote, Landmark, Wallet, Calculator } from 'lucide-react';

const ICON_BY_CODE = {
  UPI:         Smartphone,
  CASH:        Banknote,
  CARD:        CreditCard,
  CREDITCARD:  CreditCard,
  DEBITCARD:   CreditCard,
  NETBANKING:  Landmark,
  WALLET:      Wallet,
  EMI:         Calculator,
};

function iconFor(modeCode) {
  const key = (modeCode ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return ICON_BY_CODE[key] ?? CreditCard;
}

/**
 * @param {{
 *   paymentModes: { modeId: number, modeName: string, modeCode?: string }[],
 *   selectedModeIds: number[],
 *   onToggle: (modeId: number) => void,
 *   isLoading?: boolean,
 *   isError?: boolean,
 * }} props
 */
export default function PaymentModeSelector({
  paymentModes,
  selectedModeIds,
  onToggle,
  isLoading,
  isError,
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading payment modes…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive py-2">
        Failed to load payment modes. Please try again.
      </p>
    );
  }

  if (paymentModes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No payment modes available.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {paymentModes.map((mode) => {
        const isSelected = selectedModeIds.includes(mode.modeId);
        const Icon = iconFor(mode.modeCode);
        return (
          <button
            key={mode.modeId}
            type="button"
            onClick={() => onToggle(mode.modeId)}
            aria-pressed={isSelected}
            className={`
              relative flex flex-col items-center justify-center gap-1.5
              min-h-[72px] px-2 py-3 rounded-xl border text-sm font-medium
              transition-colors
              ${isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground/80 hover:border-muted-foreground/30'}
            `}
          >
            {isSelected && (
              <span
                className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-hidden="true"
              >
                <Check size={10} />
              </span>
            )}
            <Icon size={20} className={isSelected ? 'text-primary' : 'text-muted-foreground'} aria-hidden="true" />
            <span className="truncate max-w-full text-xs">{mode.modeName}</span>
          </button>
        );
      })}
    </div>
  );
}
