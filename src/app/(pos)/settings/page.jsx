// src/app/(pos)/settings/page.jsx
'use client';

import { Suspense } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAddMetalRate } from '@/hooks/settings/useAddMetalRate';
import APP_CONFIG from '@/constants/appConfig';
import PageLoader from '@/components/shared/PageLoader';
import { Input } from '@/components/ui/input';
import { todayDateString } from '@/lib/dateUtils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const metalRateSchema = z.object({
  metal_type_id: z.coerce
    .number({ required_error: 'Select a metal type.' })
    .int()
    .positive('Select a metal type.'),
  purchase_rate: z.coerce
    .number({ required_error: 'Purchase rate is required.' })
    .positive('Purchase rate must be greater than 0.'),
  sales_rate: z.coerce
    .number({ required_error: 'Sales rate is required.' })
    .positive('Sales rate must be greater than 0.'),
  from_date: z
    .string({ required_error: 'Effective date is required.' })
    .min(1, 'Effective date is required.'),
});

// ─── Metal type options (from APP_CONFIG — never hardcode IDs) ────────────────

const METAL_OPTIONS = [
  { label: 'Gold',      value: APP_CONFIG.METAL_TYPES.GOLD },
  { label: 'Silver',    value: APP_CONFIG.METAL_TYPES.SILVER },
  { label: 'Platinum',  value: APP_CONFIG.METAL_TYPES.PLATINUM },
  { label: 'Palladium', value: APP_CONFIG.METAL_TYPES.PALLADIUM },
  { label: 'Alloy',     value: APP_CONFIG.METAL_TYPES.ALLOY },
];

// ─── Metal Rate Form ──────────────────────────────────────────────────────────

function MetalRateForm() {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(metalRateSchema),
    defaultValues: {
      metal_type_id: '',
      purchase_rate: '',
      sales_rate:    '',
      from_date:     todayDateString(),
    },
  });

  const mutation = useAddMetalRate({
    onSuccess: () => reset({
      metal_type_id: '',
      purchase_rate: '',
      sales_rate:    '',
      from_date:     todayDateString(),
    }),
  });

  const onSubmit = (data) => {
    mutation.mutate({
      metal_type_id: data.metal_type_id,
      purchase_rate: data.purchase_rate,
      sales_rate:    data.sales_rate,
      from_date:     data.from_date,
      currency_id:   APP_CONFIG.CURRENCY.INR_ID,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Metal Type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Metal Type <span className="text-destructive">*</span>
        </label>
        <Controller
          name="metal_type_id"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select metal type" />
              </SelectTrigger>
              <SelectContent>
                {METAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.metal_type_id && (
          <p className="text-xs text-destructive">{errors.metal_type_id.message}</p>
        )}
      </div>

      {/* Purchase Rate */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Purchase Rate (₹) <span className="text-destructive">*</span>
        </label>
        <Input
          {...register('purchase_rate')}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="h-11"
        />
        {errors.purchase_rate && (
          <p className="text-xs text-destructive">{errors.purchase_rate.message}</p>
        )}
      </div>

      {/* Sales Rate */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Sales Rate (₹) <span className="text-destructive">*</span>
        </label>
        <Input
          {...register('sales_rate')}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="h-11"
        />
        {errors.sales_rate && (
          <p className="text-xs text-destructive">{errors.sales_rate.message}</p>
        )}
      </div>

      {/* Effective Date */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Effective Date <span className="text-destructive">*</span>
        </label>
        <Input
          {...register('from_date')}
          type="date"
          max={todayDateString()}
          className="h-11"
        />
        {errors.from_date && (
          <p className="text-xs text-destructive">{errors.from_date.message}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {mutation.isPending ? 'Saving…' : 'Save Metal Rate'}
      </button>

    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SettingsScreen() {
  return (
    <div className="p-4 pb-8 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage store configuration
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">Metal Rates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set purchase and sales rates per metal type
          </p>
        </div>
        <div className="p-4">
          <MetalRateForm />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SettingsScreen />
    </Suspense>
  );
}