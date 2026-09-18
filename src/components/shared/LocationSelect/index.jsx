'use client';

// Shared Country/State/City picker (shadcn Select-based). Generic over any
// { [idKey]: number, [labelKey]: string } list, so one component serves
// country/state/city cascades.

import { Controller } from 'react-hook-form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export default function LocationSelect({
  control,
  name,
  items,
  idKey,
  labelKey,
  placeholder = 'Select',
  disabled = false,
  disabledPlaceholder,
  isLoading = false,
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          value={field.value != null ? String(field.value) : ''}
          onValueChange={(value) => field.onChange(Number(value))}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue
              placeholder={isLoading ? 'Loading…' : (disabled ? disabledPlaceholder : placeholder)}
            />
          </SelectTrigger>
          {/* position="popper" — FIXED 2026-09-18 (reported: selecting a
              Nationality option didn't register and the page started
              scrolling horizontally with extra vertical whitespace).
              Radix's default "item-aligned" mode has no width clamp at all
              (only popper mode's data-[position=popper]:w-full/min-w classes
              in ui/select.jsx apply), so a ~195-country list with long
              labels ("United Kingdom of Great Britain and Northern
              Ireland") rendered a popover wider than the viewport — and
              item-aligned mode has no collision/flip avoidance, so opening
              it near the bottom of the form (Nationality is always the
              last field) let it spill past the viewport edges, which the
              browser counts as page overflow. The "selection not
              registering" symptom was this layout thrashing hiding the
              updated SelectValue off-screen, not a real state bug — the
              onChange wiring here is byte-for-byte identical to Country's,
              which never hit this because it has more room below it.
              Popper mode clamps width to the trigger's own width and uses
              real collision-based positioning, fixing both. */}
          <SelectContent position="popper">
            {items.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {isLoading ? 'Loading…' : 'No options found'}
              </div>
            )}
            {items.map((item) => (
              <SelectItem key={item[idKey]} value={String(item[idKey])}>
                {item[labelKey]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
