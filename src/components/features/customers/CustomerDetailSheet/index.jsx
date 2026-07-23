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
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

import BottomSheet from '@/components/shared/BottomSheet';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import LocationSelect from '@/components/shared/LocationSelect';
import PillTabs from '@/components/shared/PillTabs';

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
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone size={15} className="shrink-0 text-muted-foreground/70" />
            {customerMobile}
          </div>
        )}
        {customerEmail && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail size={15} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{customerEmail}</span>
          </div>
        )}
        {customerAddress && (customerAddress.address || customerAddress.city) && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin size={15} className="shrink-0 text-muted-foreground/70 mt-0.5" />
            <span>
              {[customerAddress.address, customerAddress.city, customerAddress.state, customerAddress.zip]
                .filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {customerPan && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard size={15} className="shrink-0 text-muted-foreground/70" />
            PAN: {maskPan(customerPan)}
          </div>
        )}
        {partyCode && (
          <p className="text-xs text-muted-foreground/70">Code: {partyCode}</p>
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

// OrnaVerse pre-masks mobile/email/address on List/Retrieve (e.g.
// "******3030", "c***@yahoo.com", "Chakrava***") — confirmed live against
// UAT 2026-07-19. A masked string fails mobile's format check, but email/
// address have no such guard, so pre-filling them as editable text risks
// silently round-tripping the masked placeholder back as the "new" value
// on save (Update requires the full record). Never pre-fill a masked-looking
// value into an editable input — leave it blank and show it as a read-only
// hint instead.
function looksMasked(value) {
  return typeof value === 'string' && value.includes('*');
}

// ── Edit Tab ──────────────────────────────────────────────────────────────────
function EditTab({ customer }) {
  // Fetch full record for the update payload merge
  const { customer: fullCustomer, isLoading: loadingFull } = useRetrieveCustomer(customer.customerId);
  const updateCustomer = useUpdateCustomer();

  const raw = fullCustomer?.raw ?? customer.raw;

  // Masked display values — shown as a read-only hint next to the (blank)
  // editable input for whichever fields OrnaVerse actually masked. Sourced
  // from `raw` (not the top-level normalized customer.customerMobile etc.)
  // so this stays in sync with what the reset() effect below does once the
  // fuller Retrieve record replaces the initial List-sourced one.
  const maskedMobile  = looksMasked(raw?.mobile)  ? raw.mobile  : null;
  const maskedEmail   = looksMasked(raw?.email)   ? raw.email   : null;
  const maskedAddress = looksMasked(raw?.address) ? raw.address : null;

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      party_name: customer.customerName ?? '',
      mobile:     maskedMobile ? '' : customer.customerMobile ?? '',
      email:      maskedEmail  ? '' : customer.customerEmail  ?? '',
      pan_no:     customer.customerPan ?? '',
      address:    maskedAddress ? '' : customer.customerAddress?.address ?? '',
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
      mobile:     looksMasked(r.mobile) ? '' : r.mobile ?? '',
      email:      looksMasked(r.email)  ? '' : (r.email && r.email !== 'NA' ? r.email : ''),
      pan_no:     r.pan_no && r.pan_no !== 'NA' ? r.pan_no : '',
      address:    looksMasked(r.address) ? '' : r.address ?? '',
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
    // Blank mobile/email/address means "not touched" (they were left blank
    // deliberately — see looksMasked above) — fall back to the original raw
    // value rather than submitting an empty string, since Update requires
    // the full record.
    await updateCustomer.mutateAsync({
      partyId:     customer.customerId,
      originalRaw: raw,
      formChanges: {
        ...formChanges,
        mobile:  formChanges.mobile  || raw.mobile,
        email:   formChanges.email   || raw.email,
        address: formChanges.address || raw.address,
      },
    });
  };

  return (
    <div className="relative">
      {/* Subtle loading overlay while full record fetches — form is still usable */}
      {loadingFull && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
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
          <Label htmlFor="ds_mobile">Mobile</Label>
          {maskedMobile && (
            <p className="text-xs text-muted-foreground">Current: {maskedMobile} (masked for privacy)</p>
          )}
          <Input
            id="ds_mobile" type="tel" inputMode="numeric" {...register('mobile')} className="h-11"
            placeholder={maskedMobile ? 'Enter new mobile to change' : undefined}
          />
          {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_email">Email</Label>
          {maskedEmail && (
            <p className="text-xs text-muted-foreground">Current: {maskedEmail} (masked for privacy)</p>
          )}
          <Input
            id="ds_email" type="email" {...register('email')} className="h-11"
            placeholder={maskedEmail ? 'Enter new email to change' : undefined}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_pan_no">PAN</Label>
          <Input id="ds_pan_no" {...register('pan_no')} className="h-11" style={{ textTransform: 'uppercase' }} />
          {errors.pan_no && <p className="text-sm text-destructive">{errors.pan_no.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Address</Label>
          {maskedAddress && (
            <p className="text-xs text-muted-foreground">Current: {maskedAddress} (masked for privacy)</p>
          )}
          <Input
            {...register('address')} className="h-11"
            placeholder={maskedAddress ? 'Enter new address line 1 to change' : 'Address line 1'}
          />
          <Input {...register('address_1')} className="h-11" placeholder="Address line 2 (optional)" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Country</Label>
          <LocationSelect
            control={control}
            name="country_id" items={countries} idKey="country_id" labelKey="country_name"
            placeholder="Select country" isLoading={countriesLoading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>State</Label>
          <LocationSelect
            control={control}
            name="state_id" items={states} idKey="state_id" labelKey="state_name"
            placeholder="Select state" disabled={!countryId} disabledPlaceholder="Select country first"
            isLoading={statesLoading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>City</Label>
          <LocationSelect
            control={control}
            name="city_id" items={cities} idKey="city_id" labelKey="city_name"
            placeholder="Select city" disabled={!stateId} disabledPlaceholder="Select state first"
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
      <PillTabs
        tabs={TABS}
        value={activeTab}
        onChange={setActiveTab}
        getKey={(t) => t}
        getLabel={(t) => TAB_LABELS[t]}
        className="pb-3 -mx-1 px-1"
      />

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