'use client';

// src/components/shared/MetalTypeSelect/index.jsx
//
// Shared Metal Type picker for URD Purchase / Buyback / Exchange line items.
//
// Also fixes a live crash: `APP_CONFIG.METAL_TYPES` is an ID-lookup OBJECT
// ({ GOLD: 106, SILVER: 107, ... }), not an array. All three callers did
// `APP_CONFIG.METAL_TYPES ?? [{ id: 1, name: 'Gold' }, ...]` — since the
// object is truthy, the array fallback never took effect, and
// `METAL_TYPES.map(...)` threw `TypeError: METAL_TYPES.map is not a
// function` on every render of the "New" tab (confirmed live via the
// ErrorBoundaryHandler catching it on /urd-purchase). This derives the
// option list from the real OrnaVerse metal-type IDs instead.

import { Controller } from 'react-hook-form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import APP_CONFIG from '@/constants/appConfig';

const METAL_TYPES = [
  { id: APP_CONFIG.METAL_TYPES.GOLD,     name: 'Gold' },
  { id: APP_CONFIG.METAL_TYPES.SILVER,   name: 'Silver' },
  { id: APP_CONFIG.METAL_TYPES.PLATINUM, name: 'Platinum' },
];

export default function MetalTypeSelect({ control, name, placeholder = 'Select metal' }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value ? String(field.value) : ''}
          onValueChange={(value) => field.onChange(Number(value))}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {METAL_TYPES.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
