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
import { useSalesPersonOptions } from '@/hooks/schemes/useSalesPersonOptions';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';
import {
  selectCartCustomerId,
  selectCartCustomerName,
  selectCartCustomerMobile,
} from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

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
  scheme_id:        z.coerce.number().min(1, 'Select a scheme'),
  scheme_amount:    z.coerce.number().min(1, 'Enter monthly amount'),
  tenure:           z.coerce.number().min(1, 'Enter tenure in months'),
  document_date:    z.string().min(1, 'Required'),
  sales_person_id:  z.coerce.number().min(1, 'Select a sales person'),
  nominee:          z.string().optional(),
  nominee_age:      z.coerce.number().optional(),
});

// ── Inner screen ──────────────────────────────────────────────
function EnrollScreen() {
  const router         = useRouter();
  const storeId        = useSelector(selectActiveStoreId);
  const customerId     = useSelector(selectCartCustomerId);
  const customerName   = useSelector(selectCartCustomerName);
  const customerMobile = useSelector(selectCartCustomerMobile);

  const { schemes, isLoading: schemesLoading } = useSchemes();
  const enroll = useEnrollCustomer();

  // sales_person_id is a confirmed-required field on SchemeEnrollment/Create
  // (per v1.json SchemeEnrollmentRow). Mirrors the vendor's own Scheme
  // Enrollment screen: a store-scoped picker, not an auto-resolved value —
  // confirmed via a real UAT response listing employees by company_id only.
  const { salesPersons, isLoading: salesPersonsLoading } = useSalesPersonOptions(storeId);

  const today = todayDateString();

  const {
    register, handleSubmit, control, watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(enrollSchema),
    defaultValues: {
      scheme_id:        '',
      scheme_amount:    '',
      tenure:           '',
      document_date:    today,
      sales_person_id:  '',
      nominee:          '',
      nominee_age:      '',
    },
  });

  const watchedSchemeId = watch('scheme_id');
  const selectedScheme  = schemes.find((s) => s.scheme_id === Number(watchedSchemeId));

  const onSubmit = async (data) => {
    if (!customerId || !selectedScheme) return;

    const schemeAmount = Number(data.scheme_amount);
    const tenure        = Number(data.tenure);

    await enroll.mutateAsync({
      party_id:      customerId,
      party_name:    customerName   ?? undefined,
      mobile:        customerMobile ?? undefined,
      company_id:    storeId,
      scheme_id:     Number(data.scheme_id),
      scheme_amount: schemeAmount,
      tenure:        tenure,
      // Required by OrnaVerse (400: "Scheme Amount field is required!" / total_amount).
      // Total principal committed over the full tenure — monthly amount × months.
      total_amount:  schemeAmount * tenure,
      document_date: data.document_date,
      // Confirmed required on SchemeEnrollmentRow (v1.json) — picked from a
      // store-scoped list (see useSalesPersonOptions.js), mirroring the
      // vendor's own Scheme Enrollment screen.
      sales_person_id: Number(data.sales_person_id),
      // Copied from the scheme's own definition (SchemesRow) rather than guessed —
      // these are enum/config values that belong to the scheme itself, not invented
      // per-enrollment. All confirmed present on SchemesRow in v1.json.
      scheme_type:   selectedScheme.scheme_type,
      frequency:     selectedScheme.frequency,
      bonus_type:    selectedScheme.bonus_type,
      bonus_value:   selectedScheme.bonus_value,
      use_rules:     selectedScheme.use_rules,
      ...(data.nominee    ? { nominee:     data.nominee }               : {}),
      ...(data.nominee_age ? { nominee_age: Number(data.nominee_age) } : {}),
      // NOT sent — no reliable source yet, will not guess:
      //   scheme_status       — enum 0-3, meaning undocumented anywhere (v1.json gives no labels)
      //   scheme_unique_code  — generation format unknown
      //   document_id         — meaning unclear ("document reference id"); spec shows a
      //                         default of 125 but that looks like sample data, not a rule
      //   email, party_code   — not captured anywhere in the customer session today
      //   scheme_monthly_details[] — likely server-generated from scheme_amount/tenure/
      //                         document_date; omit unless the next 400 says otherwise
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
          <Input id="enroll_date" type="date" {...register('document_date')} className="h-11" max={today} />
          {errors.document_date && <p className="text-xs text-destructive">{errors.document_date.message}</p>}
        </div>

        {/* Sales person */}
        <div className="flex flex-col gap-1.5">
          <Label>Sales Person <span className="text-destructive">*</span></Label>
          <Controller
            name="sales_person_id"
            control={control}
            render={({ field }) => {
              const selected = salesPersons.find((p) => p.employee_id === Number(field.value));
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                        {salesPersonsLoading ? 'Loading…' : selected ? selected.employee_name : 'Select sales person'}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-56 overflow-y-auto">
                    {salesPersons.map((p) => (
                      <DropdownMenuItem key={p.employee_id} onSelect={() => field.onChange(p.employee_id)}>
                        {p.employee_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
          {errors.sales_person_id && <p className="text-xs text-destructive">{errors.sales_person_id.message}</p>}
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