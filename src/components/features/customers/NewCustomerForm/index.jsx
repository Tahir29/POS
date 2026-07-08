'use client';

// src/components/features/customers/NewCustomerForm/index.jsx
// New customer creation with mobile existence check.
// Uses cascading Country → State → City dropdowns from location master.

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown } from 'lucide-react';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { customerSchema } from '@/validators/customerSchema';
import { useCreateCustomer } from '@/hooks/customer/useCreateCustomer';
import { useCountries, useStates, useCities } from '@/hooks/settings/useLocation';

export default function NewCustomerForm({ defaultMobile = '', onCreated }) {
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
      party_name:     '',
      mobile:         defaultMobile,
      email:          '',
      pan_no:         '',
      address:        '',
      address_1:      '',
      country_id:     null,
      state_id:       null,
      city_id:        null,
      pin_code:       '',
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

  const selectedCountry = countries.find((c) => c.country_id === countryId);
  const selectedState   = states.find((s) => s.state_id === stateId);
  const selectedCity    = cities.find((c) => c.city_id === watch('city_id'));

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
        <Controller
          name="country_id"
          control={control}
          render={({ field }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <span className={selectedCountry ? 'text-foreground' : 'text-muted-foreground'}>
                    {countriesLoading
                      ? 'Loading…'
                      : selectedCountry?.country_name ?? 'Select country'}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-[--radix-dropdown-menu-trigger-width]">
                {countries.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {countriesLoading ? 'Loading…' : 'No countries found'}
                  </div>
                )}
                {countries.map((c) => (
                  <DropdownMenuItem
                    key={c.country_id}
                    onSelect={() => field.onChange(c.country_id)}
                  >
                    {c.country_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      {/* State */}
      <div className="flex flex-col gap-1.5">
        <Label>State</Label>
        <Controller
          name="state_id"
          control={control}
          render={({ field }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!countryId}>
                <button
                  type="button"
                  disabled={!countryId}
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={selectedState ? 'text-foreground' : 'text-muted-foreground'}>
                    {statesLoading
                      ? 'Loading…'
                      : selectedState?.state_name ?? (countryId ? 'Select state' : 'Select country first')}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-[--radix-dropdown-menu-trigger-width]">
                {states.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {statesLoading ? 'Loading…' : 'No states found'}
                  </div>
                )}
                {states.map((s) => (
                  <DropdownMenuItem
                    key={s.state_id}
                    onSelect={() => field.onChange(s.state_id)}
                  >
                    {s.state_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </div>

      {/* City */}
      <div className="flex flex-col gap-1.5">
        <Label>City</Label>
        <Controller
          name="city_id"
          control={control}
          render={({ field }) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!stateId}>
                <button
                  type="button"
                  disabled={!stateId}
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={selectedCity ? 'text-foreground' : 'text-muted-foreground'}>
                    {citiesLoading
                      ? 'Loading…'
                      : selectedCity?.city_name ?? (stateId ? 'Select city' : 'Select state first')}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-60 overflow-y-auto w-[--radix-dropdown-menu-trigger-width]">
                {cities.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {citiesLoading ? 'Loading…' : 'No cities found'}
                  </div>
                )}
                {cities.map((c) => (
                  <DropdownMenuItem
                    key={c.city_id}
                    onSelect={() => field.onChange(c.city_id)}
                  >
                    {c.city_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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