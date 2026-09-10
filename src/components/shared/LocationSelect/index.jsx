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
