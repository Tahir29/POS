'use client';

// src/components/features/customers/CustomerDetailSheet/index.jsx
// Quick-access sheet from the customer directory.
// TABS: Profile | Edit only.
// Orders / Schemes / History / Points → full profile page (/customers/[id])
//
// Edit tab pre-fills from the customer prop (normalised shape from the list).
// useRetrieveCustomer fetches the full record in the background so the
// update payload is always complete (OrnaVerse requires full record on update).

import { useState, useEffect } from 'react';
import {
  Phone, Mail, MapPin, CreditCard, UserCircle,
  ChevronDown, Loader2,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

import BottomSheet from '@/components/shared/BottomSheet';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { updateCustomerSchema } from '@/validators/customerSchema';
import { useRetrieveCustomer }  from '@/hooks/customer/useRetrieveCustomer';
import { useUpdateCustomer }    from '@/hooks/customer/useUpdateCustomer';
import { useCountries, useStates, useCities } from '@/hooks/settings/useLocation';

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS       = ['profile', 'edit'];
const TAB_LABELS = { profile: 'Profile', edit: 'Edit' };

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ customer, onAttach, isAttached, onClose }) {
  const { customerName, customerMobile, customerEmail, customerAddress, customerPan, raw } = customer;
  const partyCode = raw?.party_code && raw.party_code !== 'NA' ? raw.party_code : null;

  function maskPan(pan) {
    if (!pan || pan.length <= 4) return pan;
    return `${'*'.repeat(pan.length - 4)}${pan.slice(-4)}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm">
        {customerMobile && (
          <div className="flex items-center gap-2 text-stone-600">
            <Phone size={15} className="shrink-0 text-stone-400" />
            {customerMobile}
          </div>
        )}
        {customerEmail && (
          <div className="flex items-center gap-2 text-stone-600">
            <Mail size={15} className="shrink-0 text-stone-400" />
            <span className="truncate">{customerEmail}</span>
          </div>
        )}
        {customerAddress && (customerAddress.address || customerAddress.city) && (
          <div className="flex items-start gap-2 text-stone-600">
            <MapPin size={15} className="shrink-0 text-stone-400 mt-0.5" />
            <span>
              {[customerAddress.address, customerAddress.city, customerAddress.state, customerAddress.zip]
                .filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {customerPan && (
          <div className="flex items-center gap-2 text-stone-600">
            <CreditCard size={15} className="shrink-0 text-stone-400" />
            PAN: {maskPan(customerPan)}
          </div>
        )}
        {partyCode && (
          <p className="text-xs text-stone-400">Code: {partyCode}</p>
        )}
      </div>

      <Button
        type="button"
        onClick={onAttach}
        disabled={isAttached}
        className="h-11 w-full"
      >
        {isAttached ? 'Already attached to cart' : 'Attach to Cart'}
      </Button>

      <Button asChild type="button" variant="outline" className="h-11 w-full gap-2">
        <Link href={`/customers/${customer.customerId}`} onClick={onClose}>
          <UserCircle size={16} />
          View Full Profile
        </Link>
      </Button>
    </div>
  );
}

// ── Edit Tab ──────────────────────────────────────────────────────────────────
function EditTab({ customer }) {
  // Fetch full record for the update payload merge
  const { customer: fullCustomer, isLoading: loadingFull } = useRetrieveCustomer(customer.customerId);
  const updateCustomer = useUpdateCustomer();

  const raw = fullCustomer?.raw ?? customer.raw;

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      party_name: customer.customerName ?? '',
      mobile:     customer.customerMobile ?? '',
      email:      customer.customerEmail ?? '',
      pan_no:     customer.customerPan ?? '',
      address:    customer.customerAddress?.address ?? '',
      address_1:  customer.customerAddress?.address1 ?? '',
      country_id: customer.customerAddress?.country_id ?? null,
      state_id:   customer.customerAddress?.state_id ?? null,
      city_id:    customer.customerAddress?.city_id ?? null,
      pin_code:   customer.customerAddress?.zip ?? '',
    },
  });

  // Re-fill once the full record arrives (has more complete data)
  useEffect(() => {
    if (!fullCustomer?.raw) return;
    const r = fullCustomer.raw;
    reset({
      party_name: r.party_name  ?? '',
      mobile:     r.mobile      ?? '',
      email:      r.email && r.email !== 'NA' ? r.email : '',
      pan_no:     r.pan_no && r.pan_no !== 'NA' ? r.pan_no : '',
      address:    r.address     ?? '',
      address_1:  r.address_1   ?? '',
      country_id: r.country_id  ?? null,
      state_id:   r.state_id    ?? null,
      city_id:    r.city_id     ?? null,
      pin_code:   r.pin_code ? String(r.pin_code) : '',
    });
  }, [fullCustomer, reset]);

  const countryId = watch('country_id');
  const stateId   = watch('state_id');

  // Only cascade-reset when user actually changes the value
  const initialCountryId = raw?.country_id ?? null;
  const initialStateId   = raw?.state_id   ?? null;
  useEffect(() => {
    if (countryId !== initialCountryId) {
      setValue('state_id', null);
      setValue('city_id', null);
    }
  }, [countryId, initialCountryId, setValue]);
  useEffect(() => {
    if (stateId !== initialStateId) {
      setValue('city_id', null);
    }
  }, [stateId, initialStateId, setValue]);

  const { countries, isLoading: countriesLoading } = useCountries();
  const { states,    isLoading: statesLoading }    = useStates(countryId);
  const { cities,    isLoading: citiesLoading }    = useCities(stateId);

  const onSubmit = async (formChanges) => {
    if (!raw) return;
    await updateCustomer.mutateAsync({
      partyId:     customer.customerId,
      originalRaw: raw,
      formChanges,
    });
  };

  // Location dropdown helper
  const LocationDropdown = ({ name, items, idKey, labelKey, placeholder, disabledMsg, disabled, isLoading: loading }) => (
    <Controller name={name} control={control} render={({ field }) => {
      const selected = items.find((i) => i[idKey] === field.value);
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              disabled={disabled}
              className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                {loading
                  ? 'Loading…'
                  : selected
                    ? selected[labelKey]
                    : disabled ? disabledMsg : placeholder}
              </span>
              <ChevronDown size={14} className="text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-56 overflow-y-auto w-[--radix-dropdown-menu-trigger-width]">
            {items.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {loading ? 'Loading…' : 'No options found'}
              </div>
            )}
            {items.map((item) => (
              <DropdownMenuItem key={item[idKey]} onSelect={() => field.onChange(item[idKey])}>
                {item[labelKey]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }} />
  );

  return (
    <div className="relative">
      {/* Subtle loading overlay while full record fetches — form is still usable */}
      {loadingFull && (
        <div className="flex items-center gap-1.5 text-xs text-stone-400 mb-3">
          <Loader2 size={11} className="animate-spin" />
          Loading full details…
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_party_name">Full name <span className="text-destructive">*</span></Label>
          <Input id="ds_party_name" {...register('party_name')} className="h-11" />
          {errors.party_name && <p className="text-sm text-destructive">{errors.party_name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_mobile">Mobile <span className="text-destructive">*</span></Label>
          <Input id="ds_mobile" type="tel" inputMode="numeric" {...register('mobile')} className="h-11" />
          {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_email">Email</Label>
          <Input id="ds_email" type="email" {...register('email')} className="h-11" />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_pan_no">PAN</Label>
          <Input id="ds_pan_no" {...register('pan_no')} className="h-11" style={{ textTransform: 'uppercase' }} />
          {errors.pan_no && <p className="text-sm text-destructive">{errors.pan_no.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Address</Label>
          <Input {...register('address')} className="h-11" placeholder="Address line 1" />
          <Input {...register('address_1')} className="h-11" placeholder="Address line 2 (optional)" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Country</Label>
          <LocationDropdown
            name="country_id" items={countries} idKey="country_id" labelKey="country_name"
            placeholder="Select country" isLoading={countriesLoading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>State</Label>
          <LocationDropdown
            name="state_id" items={states} idKey="state_id" labelKey="state_name"
            placeholder="Select state" disabled={!countryId} disabledMsg="Select country first"
            isLoading={statesLoading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>City</Label>
          <LocationDropdown
            name="city_id" items={cities} idKey="city_id" labelKey="city_name"
            placeholder="Select city" disabled={!stateId} disabledMsg="Select state first"
            isLoading={citiesLoading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_pin_code">PIN Code</Label>
          <Input
            id="ds_pin_code"
            type="text"
            inputMode="numeric"
            {...register('pin_code')}
            className="h-11"
            maxLength={6}
          />
          {errors.pin_code && <p className="text-sm text-destructive">{errors.pin_code.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={updateCustomer.isPending || !isDirty}
          className="h-11 mt-1"
        >
          {updateCustomer.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}

// ── CustomerDetailSheet ───────────────────────────────────────────────────────
export default function CustomerDetailSheet({ customer, isOpen, onClose, onAttach, isAttached }) {
  const [activeTab, setActiveTab] = useState('profile');

  // Reset to profile tab each time sheet opens for a (potentially different) customer
  useEffect(() => {
    if (isOpen) setActiveTab('profile');
  }, [isOpen, customer?.customerId]);

  if (!customer) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={customer.customerName || 'Customer'}>

      {/* Tab bar — Profile + Edit only */}
      <div className="flex gap-1 pb-3 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-1">
        {activeTab === 'profile' && (
          <ProfileTab
            customer={customer}
            onAttach={onAttach}
            isAttached={isAttached}
            onClose={onClose}
          />
        )}
        {activeTab === 'edit' && (
          <EditTab customer={customer} />
        )}
      </div>

    </BottomSheet>
  );
}