'use client';

// src/app/(pos)/customers/[customerId]/page.jsx
// Full customer profile page — reached via "View Full Profile" from CustomerDetailSheet.
//
// TABS: Profile | Edit | Orders | Schemes | History | Points
// DEFAULT TAB: Edit (so staff can immediately update customer details)
// Edit form is pre-filled from Customer/Retrieve (full record, not list snapshot)
//
// Uses useRetrieveCustomer(partyId) — direct fetch by party_id.
// No longer relies on useAllCustomers directory lookup (fragile, stale).

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Phone, Mail, MapPin, CreditCard,
  ClipboardList, BookOpen,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import LocationSelect from '@/components/shared/LocationSelect';
import PillTabs from '@/components/shared/PillTabs';

import { updateCustomerSchema }   from '@/validators/customerSchema';
import { useRetrieveCustomer }    from '@/hooks/customer/useRetrieveCustomer';
import { useUpdateCustomer }      from '@/hooks/customer/useUpdateCustomer';
import { useCustomerOrders }      from '@/hooks/customer/useCustomerOrders';
import { useCustomerEnrollments } from '@/hooks/customer/useCustomerEnrollments';
import { useCustomerHistory }     from '@/hooks/customer/useCustomerHistory';
import { useCustomerLoyalty }     from '@/hooks/customer/useCustomerLoyalty';
import { useCountries, useStates, useCities } from '@/hooks/settings/useLocation';
import APP_CONFIG from '@/constants/appConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount) {
  if (amount == null) return '—';
  return `${APP_CONFIG.CURRENCY.INR_SYMBOL}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN');
}

function maskPan(pan) {
  if (!pan || pan.length <= 4) return pan;
  return `${'*'.repeat(pan.length - 4)}${pan.slice(-4)}`;
}

const STATUS_STYLES = {
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  due:     'bg-red-50 text-red-700 border-red-200',
};

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS    = ['profile', 'edit', 'orders', 'schemes', 'history', 'points'];
const TAB_LABELS = {
  profile: 'Profile',
  edit:    'Edit',
  orders:  'Orders',
  schemes: 'Schemes',
  history: 'History',
  points:  'Points',
};

// ── Shared primitives ─────────────────────────────────────────────────────────
function TabLoading({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-500">
      <Loader2 size={16} className="animate-spin" />{label}
    </div>
  );
}
function TabError({ label, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-destructive">{label}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </div>
  );
}
function TabEmpty({ icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-stone-500">
      {icon}<p className="text-sm">{label}</p>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ customer }) {
  const { customerName, customerMobile, customerEmail, customerPan, customerAddress, raw } = customer;
  const partyCode  = raw?.party_code && raw.party_code !== 'NA' ? raw.party_code : null;
  const birthDate  = raw?.birth_date  ? fmtDate(raw.birth_date)  : null;
  const anniversary= raw?.anniversary ? fmtDate(raw.anniversary) : null;
  const maskedPan  = maskPan(customerPan);

  return (
    <div className="flex flex-col gap-3 text-sm">
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
      {maskedPan && (
        <div className="flex items-center gap-2 text-stone-600">
          <CreditCard size={15} className="shrink-0 text-stone-400" />
          PAN: {maskedPan}
        </div>
      )}
      {partyCode && (
        <p className="text-xs text-stone-400">Customer code: {partyCode}</p>
      )}
      {birthDate && (
        <p className="text-xs text-stone-500">Birthday: {birthDate}</p>
      )}
      {anniversary && (
        <p className="text-xs text-stone-500">Anniversary: {anniversary}</p>
      )}
    </div>
  );
}

// ── Edit Tab ──────────────────────────────────────────────────────────────────
function EditTab({ customer, onSaved }) {
  const updateCustomer = useUpdateCustomer();
  const raw = customer.raw;

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      party_name:  raw?.party_name  ?? '',
      mobile:      raw?.mobile      ?? '',
      email:       raw?.email && raw.email !== 'NA' ? raw.email : '',
      pan_no:      raw?.pan_no && raw.pan_no !== 'NA' ? raw.pan_no : '',
      address:     raw?.address     ?? '',
      address_1:   raw?.address_1   ?? '',
      country_id:  raw?.country_id  ?? null,
      state_id:    raw?.state_id    ?? null,
      city_id:     raw?.city_id     ?? null,
      pin_code:    raw?.pin_code ? String(raw.pin_code) : '',
    },
  });

  // Re-fill if customer raw changes (e.g. after save + refetch)
  useEffect(() => {
    reset({
      party_name:  raw?.party_name  ?? '',
      mobile:      raw?.mobile      ?? '',
      email:       raw?.email && raw.email !== 'NA' ? raw.email : '',
      pan_no:      raw?.pan_no && raw.pan_no !== 'NA' ? raw.pan_no : '',
      address:     raw?.address     ?? '',
      address_1:   raw?.address_1   ?? '',
      country_id:  raw?.country_id  ?? null,
      state_id:    raw?.state_id    ?? null,
      city_id:     raw?.city_id     ?? null,
      pin_code:    raw?.pin_code ? String(raw.pin_code) : '',
    });
  }, [raw, reset]);

  const countryId = watch('country_id');
  const stateId   = watch('state_id');

  // Only reset children when parent actually changes from the loaded value
  useEffect(() => {
    if (countryId !== raw?.country_id) {
      setValue('state_id', null);
      setValue('city_id', null);
    }
  }, [countryId, raw?.country_id, setValue]);

  useEffect(() => {
    if (stateId !== raw?.state_id) {
      setValue('city_id', null);
    }
  }, [stateId, raw?.state_id, setValue]);

  const { countries, isLoading: countriesLoading } = useCountries();
  const { states,    isLoading: statesLoading }    = useStates(countryId);
  const { cities,    isLoading: citiesLoading }    = useCities(stateId);

  const onSubmit = async (formChanges) => {
    await updateCustomer.mutateAsync({
      partyId:     customer.customerId,
      originalRaw: raw,
      formChanges,
    });
    onSaved?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ep_name">Full name <span className="text-destructive">*</span></Label>
        <Input id="ep_name" {...register('party_name')} className="h-11" />
        {errors.party_name && <p className="text-sm text-destructive">{errors.party_name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ep_mobile">Mobile <span className="text-destructive">*</span></Label>
        <Input id="ep_mobile" type="tel" inputMode="numeric" {...register('mobile')} className="h-11" />
        {errors.mobile && <p className="text-sm text-destructive">{errors.mobile.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ep_email">Email</Label>
        <Input id="ep_email" type="email" {...register('email')} className="h-11" />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ep_pan">PAN</Label>
        <Input id="ep_pan" {...register('pan_no')} className="h-11" style={{ textTransform: 'uppercase' }} />
        {errors.pan_no && <p className="text-sm text-destructive">{errors.pan_no.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Address</Label>
        <Input {...register('address')} className="h-11" placeholder="Address line 1" />
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
        <Label htmlFor="ep_pin">PIN Code</Label>
        <Input id="ep_pin" type="text" inputMode="numeric" {...register('pin_code')} className="h-11" maxLength={6} />
        {errors.pin_code && <p className="text-sm text-destructive">{errors.pin_code.message}</p>}
      </div>

      <Button type="submit" disabled={updateCustomer.isPending || !isDirty} className="h-11 mt-1">
        {updateCustomer.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

// ── Orders Tab ────────────────────────────────────────────────────────────────
function OrdersTab({ customerId }) {
  const { orders, isLoading, isError, refetch } = useCustomerOrders({ customerId });

  if (isLoading) return <TabLoading label="Loading orders…" />;
  if (isError)   return <TabError label="Failed to load orders." onRetry={refetch} />;
  if (!orders.length) return <TabEmpty icon={<ClipboardList size={28} className="text-stone-300" />} label="No orders found." />;

  return (
    <div className="flex flex-col gap-2">
      {orders.map((order, idx) => (
        <div key={order.orderId ?? idx} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-stone-800 truncate">{order.orderNo ?? `#${order.orderId}`}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[order.status] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                {order.status}
              </span>
            </div>
            {order.orderDate && <p className="text-xs text-stone-400 mt-0.5">{fmtDate(order.orderDate)}</p>}
          </div>
          <div className="text-right shrink-0">
            {order.totalAmount != null && <p className="text-sm font-semibold text-stone-800">{fmt(order.totalAmount)}</p>}
            {order.balanceAmount > 0 && <p className="text-xs text-red-500">Due {fmt(order.balanceAmount)}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Schemes Tab ───────────────────────────────────────────────────────────────
function SchemesTab({ customerId }) {
  const { enrollments, isLoading, isError, refetch } = useCustomerEnrollments({ customerId });

  if (isLoading) return <TabLoading label="Loading schemes…" />;
  if (isError)   return <TabError label="Failed to load schemes." onRetry={refetch} />;
  if (!enrollments.length) return <TabEmpty icon={<BookOpen size={28} className="text-stone-300" />} label="No scheme enrollments." />;

  return (
    <div className="flex flex-col gap-2">
      {enrollments.map((e, idx) => (
        <div key={e.enrollmentId ?? idx} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-800 truncate">{e.schemeName ?? 'Scheme'}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {fmt(e.schemeAmount)}/month · {e.tenure} months
              {e.enrolledDate ? ` · ${fmtDate(e.enrolledDate)}` : ''}
            </p>
            {e.investedAmount != null && (
              <p className="text-xs text-stone-500 mt-0.5">Paid: {fmt(e.investedAmount)}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.hasPendingInstallment ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
            {e.hasPendingInstallment ? 'Active' : 'Completed'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
// Rebuilt 2026-07-16 — see useCustomerHistory.js header: the real API only
// gives an invoice list + a payment-mode breakdown, not a Credit Balance/
// Exchange Value/Buy Back Value summary (no working data source for those).
function HistoryTab({ customerId }) {
  const { invoiceTotal, receiptModes, invoices, isLoading, isError, refetch } = useCustomerHistory(customerId);

  if (isLoading) return <TabLoading label="Loading history…" />;
  if (isError)   return <TabError label="Failed to load history." onRetry={refetch} />;
  if (!invoices.length && !receiptModes.length) {
    return <TabEmpty icon={<ClipboardList size={28} className="text-stone-300" />} label="No purchase history found." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-stone-100 p-3">
        <p className="text-xs text-stone-400">Total Purchases</p>
        <p className="text-sm font-semibold text-stone-800 mt-0.5">{fmt(invoiceTotal)}</p>
      </div>

      {receiptModes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">By Payment Mode</p>
          {receiptModes.map((r, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm rounded-lg border border-stone-100 px-3 py-2">
              <span className="text-stone-700">{r.mode}</span>
              <span className="font-semibold text-stone-800">{fmt(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {invoices.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Recent Invoices</p>
          {invoices.slice(0, 10).map((inv, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm rounded-lg border border-stone-100 px-3 py-2">
              <div>
                <p className="text-stone-700 font-medium">{inv.document_no ?? `Invoice #${idx + 1}`}</p>
                {inv.document_date && <p className="text-xs text-stone-400">{fmtDate(inv.document_date)}</p>}
              </div>
              <span className="font-semibold text-stone-800">{fmt(inv.net_amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Points Tab ────────────────────────────────────────────────────────────────
function PointsTab({ customerId }) {
  const { availablePoints, loyaltyHistory, isLoading, isError, refetch } = useCustomerLoyalty(customerId);

  if (isLoading) return <TabLoading label="Loading points…" />;
  if (isError)   return <TabError label="Failed to load loyalty points." onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-stone-100 bg-stone-50 p-4 text-center">
        <p className="text-xs text-stone-400 uppercase tracking-wide">Available Points</p>
        <p className="text-3xl font-bold text-primary mt-1">{availablePoints.toLocaleString('en-IN')}</p>
      </div>
      {loyaltyHistory.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">History</p>
          {loyaltyHistory.slice(0, 20).map((h, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm rounded-lg border border-stone-100 px-3 py-2">
              <span className="text-stone-500 text-xs">{fmtDate(h.document_date)}</span>
              <div className="text-right">
                {h.points_earned > 0 && <span className="text-emerald-600 font-medium">+{h.points_earned}</span>}
                {h.points_redeemed > 0 && <span className="text-red-500 font-medium ml-2">-{h.points_redeemed}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const params     = useParams();
  const router     = useRouter();
  const partyId    = Number(params?.customerId);

  // Default to Edit tab so staff can immediately update details
  const [activeTab, setActiveTab] = useState('edit');

  // Fetch full customer record directly by party_id
  const { customer, isLoading, isError, refetch } = useRetrieveCustomer(partyId, {
    enabled: !!partyId,
  });

  const handleSaved = () => {
    refetch();
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/customers')}
          aria-label="Back to customers"
          className="h-9 w-9 -ml-2 shrink-0"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Button>
        <h1 className="text-base font-bold text-stone-800 truncate">
          {customer?.customerName ?? 'Customer Profile'}
        </h1>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <Loader2 size={16} className="animate-spin" />
          Loading customer…
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">Failed to load customer.</p>
          <Button type="button" variant="outline" onClick={refetch}>Retry</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/customers')}>
            Back to Customers
          </Button>
        </div>
      )}

      {/* Content */}
      {customer && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">

          {/* Customer name + code header */}
          <div>
            <h2 className="text-base font-bold text-stone-800">{customer.customerName}</h2>
            {customer.raw?.party_code && customer.raw.party_code !== 'NA' && (
              <p className="text-xs text-stone-400 mt-0.5">Code: {customer.raw.party_code}</p>
            )}
          </div>

          {/* Tab bar */}
          <PillTabs
            tabs={TABS}
            value={activeTab}
            onChange={setActiveTab}
            getKey={(t) => t}
            getLabel={(t) => TAB_LABELS[t]}
            scrollable
            className="-mx-1 px-1 pb-1"
          />

          {/* Tab content */}
          <div>
            {activeTab === 'profile' && <ProfileTab customer={customer} />}
            {activeTab === 'edit'    && <EditTab customer={customer} onSaved={handleSaved} />}
            {activeTab === 'orders'  && <OrdersTab customerId={customer.customerId} />}
            {activeTab === 'schemes' && <SchemesTab customerId={customer.customerId} />}
            {activeTab === 'history' && <HistoryTab customerId={customer.customerId} />}
            {activeTab === 'points'  && <PointsTab customerId={customer.customerId} />}
          </div>

        </div>
      )}
    </div>
  );
}