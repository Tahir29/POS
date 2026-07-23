'use client';

// src/components/features/customers/NewCustomerForm/index.jsx
// New customer creation with mobile existence check.
// Uses cascading Country → State → City dropdowns from location master.

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import LocationSelect from '@/components/shared/LocationSelect';
import { customerSchema } from '@/validators/customerSchema';
import { useCreateCustomer } from '@/hooks/customer/useCreateCustomer';
import { useCountries, useStates, useCities } from '@/hooks/settings/useLocation';
import { todayDateString } from '@/lib/dateUtils';

// OrnaVerse enums (see customerSchema.js) — no master-data endpoint for
// these, they're fixed values.
const GENDER_OPTIONS = [
  { value: 1, label: 'Male' },
  { value: 2, label: 'Female' },
  { value: 3, label: 'Other' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 1, label: 'Single' },
  { value: 2, label: 'Married' },
];

export default function NewCustomerForm({ defaultMobile = '', defaultName = '', onCreated }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      party_name:     defaultName,
      mobile:         defaultMobile,
      email:          '',
      pan_no:         '',
      address:        '',
      address_1:      '',
      country_id:     null,
      state_id:       null,
      city_id:        null,
      pin_code:       '',
      birth_date:     '',
      anniversary:    '',
      gender:         null,
      marital_status: null,
    },
  });

  const countryId = watch('country_id');
  const stateId   = watch('state_id');

  useEffect(() => {
    setValue('state_id', null);
    setValue('city_id', null);
  }, [countryId, setValue]);

  useEffect(() => {
    setValue('city_id', null);
  }, [stateId, setValue]);

  const { countries, isLoading: countriesLoading } = useCountries();
  const { states,    isLoading: statesLoading }    = useStates(countryId);
  const { cities,    isLoading: citiesLoading }    = useCities(stateId);

  const createCustomer = useCreateCustomer();

  const onSubmit = async (values) => {
    try {
      // mutateAsync now returns { customerId, customerName, customerMobile, _existing }
      const result = await createCustomer.mutateAsync(values);
      onCreated?.({
        customerId:     result.customerId,
        customerName:   result.customerName,
        customerMobile: result.customerMobile,
      });
    } catch {
      // Error toast handled by useCreateCustomer
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="party_name">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="party_name"
          {...register('party_name')}
          className="h-11"
          placeholder="Customer full name"
        />
        {errors.party_name && (
          <p className="text-sm text-destructive">{errors.party_name.message}</p>
        )}
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mobile">
          Mobile number <span className="text-destructive">*</span>
        </Label>
        <Input
          id="mobile"
          type="tel"
          inputMode="numeric"
          {...register('mobile')}
          className="h-11"
          placeholder="10-digit mobile"
        />
        {errors.mobile && (
          <p className="text-sm text-destructive">{errors.mobile.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">
          Email <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className="h-11"
          placeholder="customer@email.com"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* PAN */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pan_no">
          PAN <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="pan_no"
          {...register('pan_no')}
          className="h-11"
          placeholder="ABCDE1234F"
          style={{ textTransform: 'uppercase' }}
        />
        {errors.pan_no && (
          <p className="text-sm text-destructive">{errors.pan_no.message}</p>
        )}
      </div>

      {/* Birth date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="birth_date">
          Date of birth <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="birth_date"
          type="date"
          max={todayDateString()}
          {...register('birth_date')}
          className="h-11"
        />
        {errors.birth_date && (
          <p className="text-sm text-destructive">{errors.birth_date.message}</p>
        )}
      </div>

      {/* Anniversary */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anniversary">
          Anniversary <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="anniversary"
          type="date"
          max={todayDateString()}
          {...register('anniversary')}
          className="h-11"
        />
        {errors.anniversary && (
          <p className="text-sm text-destructive">{errors.anniversary.message}</p>
        )}
      </div>

      {/* Gender */}
      <div className="flex flex-col gap-1.5">
        <Label>
          Gender <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Controller
          name="gender"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value != null ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={String(g.value)}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Marital status */}
      <div className="flex flex-col gap-1.5">
        <Label>
          Marital status <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Controller
          name="marital_status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value != null ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select marital status" />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_STATUS_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <Label>
          Address <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          {...register('address')}
          className="h-11"
          placeholder="Address line 1"
        />
        <Input
          {...register('address_1')}
          className="h-11"
          placeholder="Address line 2 (optional)"
        />
      </div>

      {/* Country */}
      <div className="flex flex-col gap-1.5">
        <Label>Country</Label>
        <LocationSelect
          control={control}
          name="country_id"
          items={countries}
          idKey="country_id"
          labelKey="country_name"
          placeholder="Select country"
          isLoading={countriesLoading}
        />
      </div>

      {/* State */}
      <div className="flex flex-col gap-1.5">
        <Label>State</Label>
        <LocationSelect
          control={control}
          name="state_id"
          items={states}
          idKey="state_id"
          labelKey="state_name"
          placeholder="Select state"
          disabled={!countryId}
          disabledPlaceholder="Select country first"
          isLoading={statesLoading}
        />
      </div>

      {/* City */}
      <div className="flex flex-col gap-1.5">
        <Label>City</Label>
        <LocationSelect
          control={control}
          name="city_id"
          items={cities}
          idKey="city_id"
          labelKey="city_name"
          placeholder="Select city"
          disabled={!stateId}
          disabledPlaceholder="Select state first"
          isLoading={citiesLoading}
        />
      </div>

      {/* PIN Code */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pin_code">
          PIN Code <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Input
          id="pin_code"
          type="text"
          inputMode="numeric"
          {...register('pin_code')}
          className="h-11"
          placeholder="6-digit PIN"
          maxLength={6}
        />
        {errors.pin_code && (
          <p className="text-sm text-destructive">{errors.pin_code.message}</p>
        )}
      </div>

      <Button type="submit" disabled={createCustomer.isPending} className="h-11 mt-1">
        {createCustomer.isPending ? 'Checking & creating…' : 'Create Customer'}
      </Button>
    </form>
  );
}