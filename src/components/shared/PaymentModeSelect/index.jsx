'use client';

// Shared payment/payout/refund mode picker (react-hook-form Controller +
// shadcn Select). Field values are numeric modeIds; converted to/from
// string at the Select boundary since Radix Select only works with strings.

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
