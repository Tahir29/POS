'use client';

// src/components/shared/LocationSelect/index.jsx
//
// Shared Country/State/City picker — a single shadcn Select-based
// implementation replacing 3 independently hand-built DropdownMenu copies
// (NewCustomerForm's inline blocks, and matching `LocationDropdown` helpers
// duplicated in [customerId]/page.jsx and CustomerDetailSheet).
//
// Generic over any { [idKey]: number, [labelKey]: string } list so the same
// component serves country/state/city cascades.

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
          <SelectContent>
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
