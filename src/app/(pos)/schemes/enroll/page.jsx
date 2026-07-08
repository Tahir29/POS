'use client';

// src/app/(pos)/schemes/enroll/page.jsx
// Enroll the currently-attached customer into a jewellery savings scheme.
//
// Requires a customer to be attached to the session (header control).
// Staff picks a scheme, enters monthly amount and tenure, optionally
// adds a nominee, then submits.

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronLeft } from 'lucide-react';

import { useSchemes }        from '@/hooks/schemes/useSchemes';
import { useEnrollCustomer } from '@/hooks/schemes/useEnrollCustomer';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PageLoader from '@/components/shared/PageLoader';

// ── Schema ────────────────────────────────────────────────────
const enrollSchema = z.object({
  scheme_id:     z.coerce.number().min(1, 'Select a scheme'),
  scheme_amount: z.coerce.number().min(1, 'Enter monthly amount'),
  tenure:        z.coerce.number().min(1, 'Enter tenure in months'),
  document_date: z.string().min(1, 'Required'),
  nominee:       z.string().optional(),
  nominee_age:   z.coerce.number().optional(),
});

// ── Inner screen ──────────────────────────────────────────────
function EnrollScreen() {
  const router       = useRouter();
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);

  const { schemes, isLoading: schemesLoading } = useSchemes();
  const enroll = useEnrollCustomer();

  const today = new Date().toISOString().split('T')[0];

  const {
    register, handleSubmit, control, watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(enrollSchema),
    defaultValues: {
      scheme_id:     '',
      scheme_amount: '',
      tenure:        '',
      document_date: today,
      nominee:       '',
      nominee_age:   '',
    },
  });

  const watchedSchemeId = watch('scheme_id');
  const selectedScheme  = schemes.find((s) => s.scheme_id === Number(watchedSchemeId));

  const onSubmit = async (data) => {
    if (!customerId) return;

    await enroll.mutateAsync({
      party_id:      customerId,
      company_id:    storeId,
      scheme_id:     Number(data.scheme_id),
      scheme_amount: Number(data.scheme_amount),
      tenure:        Number(data.tenure),
      document_date: data.document_date,
      ...(data.nominee    ? { nominee:     data.nominee }               : {}),
      ...(data.nominee_age ? { nominee_age: Number(data.nominee_age) } : {}),
    });

    router.push('/schemes');
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-8 max-w-2xl mx-auto">

      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 w-fit -ml-1"
      >
        <ChevronLeft size={16} /> Back to Schemes
      </button>

      <h1 className="text-xl font-semibold text-stone-800">Enroll in Scheme</h1>

      {/* Customer context */}
      <div className={`rounded-xl border p-3 text-sm ${
        customerId
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        {customerId
          ? <p className="text-emerald-700">Enrolling: <strong>{customerName}</strong></p>
          : <p className="text-amber-700">⚠ Attach a customer from the header before enrolling.</p>
        }
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

        {/* Scheme picker */}
        <div className="flex flex-col gap-1.5">
          <Label>Scheme <span className="text-destructive">*</span></Label>
          <Controller
            name="scheme_id"
            control={control}
            render={({ field }) => {
              const selected = schemes.find((s) => s.scheme_id === Number(field.value));
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                        {schemesLoading ? 'Loading…' : selected ? selected.scheme_display_name ?? selected.scheme_code : 'Select scheme'}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-56 overflow-y-auto">
                    {schemes.map((s) => (
                      <DropdownMenuItem key={s.scheme_id} onSelect={() => field.onChange(s.scheme_id)}>
                        {s.scheme_display_name ?? s.scheme_code}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
          {errors.scheme_id && <p className="text-xs text-destructive">{errors.scheme_id.message}</p>}

          {/* Scheme info card */}
          {selectedScheme && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 flex flex-col gap-1 mt-1">
              {selectedScheme.scheme_description && (
                <p>{selectedScheme.scheme_description}</p>
              )}
              {selectedScheme.scheme_code && (
                <p className="text-stone-400">Code: {selectedScheme.scheme_code}</p>
              )}
            </div>
          )}
        </div>

        {/* Monthly amount */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enroll_amount">
            Monthly Amount (₹) <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span>
            <Input
              id="enroll_amount"
              type="number"
              inputMode="decimal"
              min={1}
              placeholder="0.00"
              {...register('scheme_amount')}
              className="h-11 pl-7"
            />
          </div>
          {errors.scheme_amount && <p className="text-xs text-destructive">{errors.scheme_amount.message}</p>}
        </div>

        {/* Tenure */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enroll_tenure">
            Tenure (months) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="enroll_tenure"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 12"
            {...register('tenure')}
            className="h-11"
          />
          {errors.tenure && <p className="text-xs text-destructive">{errors.tenure.message}</p>}
        </div>

        {/* Enrollment date */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enroll_date">Start Date <span className="text-destructive">*</span></Label>
          <Input id="enroll_date" type="date" {...register('document_date')} className="h-11" />
          {errors.document_date && <p className="text-xs text-destructive">{errors.document_date.message}</p>}
        </div>

        {/* Nominee (optional) */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Nominee (Optional)</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enroll_nominee">Nominee Name</Label>
            <Input id="enroll_nominee" {...register('nominee')} className="h-11" placeholder="Full name" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="enroll_nominee_age">Nominee Age</Label>
            <Input
              id="enroll_nominee_age"
              type="number"
              inputMode="numeric"
              min={0}
              {...register('nominee_age')}
              className="h-11"
              placeholder="Age in years"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={enroll.isPending || !customerId}
          className="h-12 mt-1"
        >
          {enroll.isPending ? 'Enrolling…' : 'Confirm Enrollment'}
        </Button>

      </form>
    </div>
  );
}

export default function SchemeEnrollPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <EnrollScreen />
    </Suspense>
  );
}
