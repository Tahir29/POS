'use client';

// src/components/shared/PaymentModeSelect/index.jsx
//
// Shared payment/payout/refund mode picker — a single shadcn Select-based
// implementation replacing 6 independently hand-built DropdownMenu copies
// that had drifted (schemes, returns, transactions ×3, repair,
// urd-purchase, buyback all rebuilt the same "pick a mode_id, show its
// modeName" field from scratch with copy-pasted markup).
//
// Field values are numeric IDs (modeId) — react-hook-form's Controller
// keeps that numeric type on the wire, while the underlying shadcn/Radix
// Select works with string values internally (converted at the boundary).

import { Controller } from 'react-hook-form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/**
 * @param {{
 *   control:       object,   — react-hook-form control
 *   name:          string,   — field name bound to the mode_id
 *   paymentModes:  { modeId: number, modeName: string }[],
 *   modesLoading?: boolean,
 *   placeholder?:  string,
 *   onSelect?:     (mode: { modeId: number, modeName: string }) => void,
 * }} props
 */
export default function PaymentModeSelect({
  control,
  name,
  paymentModes,
  modesLoading = false,
  placeholder = 'Select payment mode',
  onSelect,
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value != null && field.value !== '' ? String(field.value) : ''}
          onValueChange={(value) => {
            const modeId = Number(value);
            field.onChange(modeId);
            const mode = paymentModes.find((m) => m.modeId === modeId);
            if (mode) onSelect?.(mode);
          }}
          disabled={modesLoading}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder={modesLoading ? 'Loading…' : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {paymentModes.map((mode) => (
              <SelectItem key={mode.modeId} value={String(mode.modeId)}>
                {mode.modeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
