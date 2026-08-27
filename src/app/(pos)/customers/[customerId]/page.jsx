'use client';

// Full customer profile page — reached via "View Full Profile" from CustomerDetailSheet.
//
// TABS: Profile | Edit | Orders | Schemes | History | Points
// DEFAULT TAB: Edit (so staff can immediately update customer details)
// Edit form is pre-filled from Customer/Retrieve (full record, not list snapshot)
//
// Uses useRetrieveCustomer(partyId) — direct fetch by party_id.
// No longer relies on useAllCustomers directory lookup (fragile, stale).

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MapPin, CreditCard,
  ClipboardList, BookOpen,
  ShoppingCart, FileText, RotateCcw, ArrowLeftRight, Coins, Gem, Receipt, Star, Info, Heart,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import LocationSelect from '@/components/shared/LocationSelect';
import PillTabs from '@/components/shared/PillTabs';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import InlineLoader from '@/components/shared/InlineLoader';

import { updateCustomerSchema }   from '@/validators/customerSchema';
import { useRetrieveCustomer }    from '@/hooks/customer/useRetrieveCustomer';
import { useUpdateCustomer }      from '@/hooks/customer/useUpdateCustomer';
import { useCustomerEnrollments } from '@/hooks/customer/useCustomerEnrollments';
import { useCustomerLoyalty }     from '@/hooks/customer/useCustomerLoyalty';
import { useCustomer360 }         from '@/hooks/customer/useCustomer360';
import { useCustomerWishlist }    from '@/hooks/customer/useCustomerWishlist';
import { useLiveCatalogPrices }   from '@/hooks/catalog/useLiveCatalogPrices';
import { useCrossStoreStockCodes } from '@/hooks/catalog/useCrossStoreStockCodes';
import { useCountries, useStates, useCities } from '@/hooks/settings/useLocation';
import ProductCard from '@/components/features/catalog/ProductCard';
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

// ── Tab config ────────────────────────────────────────────────────────────────
// '360' added 2026-08-12 — see useCustomer360.js. 'orders' and 'history' were
// REMOVED the same day: both were fully subsumed by 360's Order/Invoice
// sub-tabs (360 covers the same documents plus real aggregate totals
// useCustomerHistory's own header comment said it couldn't find a source
// for) — kept as separate tabs, they were just the same data shown twice.
// useCustomerOrders/useCustomerHistory hooks are left in place (still valid,
// just no longer wired to this page) rather than deleted outright.
// 'wishlist' added 2026-08-23 — reads lib/mongo/wishlist.js directly by
// party_id (see useCustomerWishlist.js), independent of wishlistSlice
// (which only ever describes whoever's currently ATTACHED to the POS
// session, not whoever's profile is being viewed here — often different
// people).
const TABS    = ['profile', 'edit', 'schemes', 'points', '360', 'wishlist'];
const TAB_LABELS = {
  profile:  'Profile',
  edit:     'Edit',
  schemes:  'Schemes',
  points:   'Points',
  '360':    '360',
  wishlist: 'Wishlist',
};

// Document-type sub-tabs inside the 360 tab's transaction table. Keys match
// useCustomer360's `documents` shape exactly. "Scheme" isn't included here —
// it's already the existing Schemes tab above, not duplicated.
const DOC_TYPES = [
  { key: 'order',    label: 'Order',        icon: ShoppingCart },
  { key: 'invoice',  label: 'Invoice',      icon: FileText },
  { key: 'return',   label: 'Return',       icon: RotateCcw },
  { key: 'urd',      label: 'URD Purchase', icon: Coins },
  { key: 'exchange', label: 'Exchange',     icon: ArrowLeftRight },
  { key: 'buyback',  label: 'Buy Back',     icon: Gem },
  { key: 'receipt',  label: 'Receipt',      icon: Receipt },
];

// Sales Insights are backend-computed and open-ended (kind/severity/title/
// detail/priority) — render whatever comes back rather than hardcoding
// per-insight copy. Icon map is best-effort by `kind`, with a generic
// fallback for any kind not yet seen.
const INSIGHT_ICON = {
  preference:         Star,
  open_order_balance: ShoppingCart,
};

function fmtWeight(grams) {
  if (grams == null) return null;
  return `${Number(grams).toFixed(3)} g`;
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function TabLoading({ label }) {
  return <InlineLoader className="py-12" label={label} />;
}
function TabError({ label, onRetry }) {
  return <ErrorState className="py-12" title={label} onRetry={onRetry} />;
}
function TabEmpty({ icon, label }) {
  return <EmptyState className="border-0 py-12" icon={icon} title={label} />;
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
      {maskedPan && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard size={15} className="shrink-0 text-muted-foreground/70" />
          PAN: {maskedPan}
        </div>
      )}
      {partyCode && (
        <p className="text-xs text-muted-foreground/70">Customer code: {partyCode}</p>
      )}
      {birthDate && (
        <p className="text-xs text-muted-foreground">Birthday: {birthDate}</p>
      )}
      {anniversary && (
        <p className="text-xs text-muted-foreground">Anniversary: {anniversary}</p>
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

// ── Schemes Tab ───────────────────────────────────────────────────────────────
function SchemesTab({ customerId }) {
  const { enrollments, isLoading, isError, refetch } = useCustomerEnrollments({ customerId });

  if (isLoading) return <TabLoading label="Loading schemes…" />;
  if (isError)   return <TabError label="Failed to load schemes." onRetry={refetch} />;
  if (!enrollments.length) return <TabEmpty icon={BookOpen} label="No scheme enrollments." />;

  return (
    <div className="flex flex-col gap-2">
      {enrollments.map((e, idx) => (
        <div key={e.enrollmentId ?? idx} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{e.schemeName ?? 'Scheme'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmt(e.schemeAmount)}/month · {e.tenure} months
              {e.enrolledDate ? ` · ${fmtDate(e.enrolledDate)}` : ''}
            </p>
            {e.investedAmount != null && (
              <p className="text-xs text-muted-foreground mt-0.5">Paid: {fmt(e.investedAmount)}</p>
            )}
            {e.nominee && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Nominee: {e.nominee}{e.nomineeAge != null ? ` (${e.nomineeAge} yrs)` : ''}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${e.hasPendingInstallment ? 'bg-status-in-stock/10 text-status-in-stock' : 'bg-muted text-muted-foreground'}`}>
            {e.hasPendingInstallment ? 'Active' : 'Completed'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 360 Tab ───────────────────────────────────────────────────────────────────
// Built 2026-08-12 — see useCustomer360.js for the three endpoints backing
// this (PARTY.RETRIEVE, CUSTOMER_HISTORY.PARTY_TRANSACTIONS, .SALES_INSIGHTS),
// all confirmed live against UAT with a real party_id before this was built.
function InsightCard({ insight }) {
  const Icon = INSIGHT_ICON[insight.kind] ?? Info;
  const elevated = insight.severity === 'high' || insight.severity === 'critical';

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        elevated ? 'border-status-error/30 bg-status-error/5' : 'border-accent/30 bg-accent/5'
      }`}
    >
      <Icon
        size={16}
        className={`shrink-0 mt-0.5 ${elevated ? 'text-status-error' : 'text-accent'}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{insight.title}</p>
        {insight.detail && <p className="text-xs text-muted-foreground mt-0.5">{insight.detail}</p>}
      </div>
    </div>
  );
}

function DocumentRow({ doc }) {
  const weight = fmtWeight(doc.net_weight ?? doc.weight);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{doc.document_no ?? '—'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.document_date ? fmtDate(doc.document_date) : '—'}
          {doc.pieces != null ? ` · ${doc.pieces} pc` : ''}
          {weight ? ` · ${weight}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        {doc.net_amount != null && <p className="text-sm font-semibold text-foreground">{fmt(doc.net_amount)}</p>}
        {doc.balance_amount > 0 && <p className="text-xs text-status-error">Due {fmt(doc.balance_amount)}</p>}
      </div>
    </div>
  );
}

function Customer360Tab({ customerId }) {
  const { insights, documents, totals, isLoading, isError, refetch } = useCustomer360(customerId);
  const [docType, setDocType] = useState('order');

  if (isLoading) return <TabLoading label="Loading customer 360…" />;
  if (isError)   return <TabError label="Failed to load customer 360." onRetry={refetch} />;

  const activeDocs = documents[docType] ?? [];
  const activeLabel = DOC_TYPES.find((d) => d.key === docType)?.label ?? 'record';

  return (
    <div className="flex flex-col gap-4">

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground/70">Total Earnings</p>
          <p className="text-sm font-semibold text-status-in-stock mt-0.5">{fmt(totals.invoiceTotal)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground/70">Credit Balance</p>
          <p className={`text-sm font-semibold mt-0.5 ${totals.creditBalance < 0 ? 'text-status-error' : 'text-foreground'}`}>
            {fmt(totals.creditBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground/70">Invoices</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{documents.invoice.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground/70">Orders</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{documents.order.length}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground/70">Returns</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{documents.return.length}</p>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sales Insights</p>
          {insights.map((insight, idx) => (
            <InsightCard key={insight.title ?? idx} insight={insight} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <PillTabs
          tabs={DOC_TYPES}
          value={docType}
          onChange={setDocType}
          variant="chip"
          scrollable
          className="-mx-1 px-1"
        />
        {activeDocs.length === 0 ? (
          <TabEmpty icon={ClipboardList} label={`No ${activeLabel.toLowerCase()} records.`} />
        ) : (
          <div className="flex flex-col gap-1.5">
            {activeDocs.map((doc, idx) => (
              <DocumentRow key={doc.transaction_id ?? doc.document_id ?? idx} doc={doc} />
            ))}
          </div>
        )}
      </div>
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
      <div className="rounded-xl border border-border bg-muted p-4 text-center">
        <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">Available Points</p>
        <p className="text-3xl font-bold text-primary mt-1">{availablePoints.toLocaleString('en-IN')}</p>
      </div>
      {loyaltyHistory.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
          {loyaltyHistory.slice(0, 20).map((h, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm rounded-lg border border-border px-3 py-2">
              <span className="text-muted-foreground text-xs">{fmtDate(h.document_date)}</span>
              <div className="text-right">
                {h.points_earned > 0 && <span className="text-status-in-stock font-medium">+{h.points_earned}</span>}
                {h.points_redeemed > 0 && <span className="text-status-error font-medium ml-2">-{h.points_redeemed}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wishlist Tab ──────────────────────────────────────────────────────────────
// Renders the exact catalog ProductCard component (2026-08-23) — same
// reasoning as RecentlyViewedCarousel: reuse, not a look-alike, so stock
// badges/star ratings/tap-to-navigate all come for free. A plain grid
// rather than a carousel — this is a dedicated tab with room to show
// everything at once, not a bottom-of-page strip fighting for space.
function WishlistTab({ customerId }) {
  const { items, isLoading, isError } = useCustomerWishlist(customerId);

  // Same live-pricing pipeline the catalog page uses — a wishlisted item's
  // price is exactly as likely to have moved since it was saved as a
  // recently-viewed one, so it gets the same "never trust a stored price"
  // treatment (see useLiveCatalogPrices' own header for why).
  const { priceById, settledIds } = useLiveCatalogPrices(items);

  // Real cross-store stock — nothing in the wishlist write path ever sets
  // has_stock (see lib/mongo/wishlist.js), so there was never a real verdict
  // here at all, only whatever the badge defaulted to. See
  // useCrossStoreStockCodes' own header for the full story.
  const itemIds = useMemo(() => items.map((i) => i.item_id), [items]);
  const { stockByItemId, isLoading: stockLoading } = useCrossStoreStockCodes(itemIds);

  if (isLoading) return <TabLoading label="Loading wishlist…" />;
  if (isError)   return <TabError label="Failed to load wishlist." />;
  if (items.length === 0) return <TabEmpty icon={Heart} label="No wishlisted products yet." />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const price = priceById.get(item.item_id) ?? null;
        const isPricing = price == null && !settledIds.has(item.item_id);
        return (
          // item_size_id in the key too (2026-08-24) — the base design and a
          // confirmed customization of the same item_id are now distinct
          // wishlist entries that can coexist (see wishlistSlice's
          // wishlistKey); item_id alone would collide once they do.
          <ProductCard
            key={`${item.item_id}-${item.item_size_id ?? 'base'}`}
            product={{ ...item, price, is_pricing: isPricing }}
            showStockBadge={!stockLoading}
            realStock={stockByItemId.get(item.item_id) ?? null}
          />
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const partyId      = Number(params?.customerId);

  // Default to Edit tab so staff can immediately update details — unless
  // arrived via a deep link (e.g. CustomerDetailSheet's "Customer 360"
  // button, ?tab=360), in which case honor that instead. Read once at mount
  // (useState initializer), not synced afterward — same one-shot pattern as
  // any other query-param-seeded initial state in this app.
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab');
    return TABS.includes(requested) ? requested : 'edit';
  });

  const { customer, isLoading, isError, refetch } = useRetrieveCustomer(partyId, {
    enabled: !!partyId,
  });

  const handleSaved = () => {
    refetch();
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">

      {/* <div className="flex items-center gap-2">
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
        <h1 className="text-base font-bold text-foreground truncate">
          {customer?.customerName ?? 'Customer Profile'}
        </h1>
      </div> */}

      {isLoading && <InlineLoader className="py-16" label="Loading customer…" />}

      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">Failed to load customer.</p>
          <Button type="button" variant="outline" onClick={refetch}>Retry</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/customers')}>
            Back to Customers
          </Button>
        </div>
      )}

      {customer && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4 shadow-sm">
          <div className='flex align-top justify-start gap-4'>
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
            <div>
              <h2 className="text-base font-bold text-foreground">{customer.customerName}</h2>
              {customer.raw?.party_code && customer.raw.party_code !== 'NA' && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">Code: {customer.raw.party_code}</p>
              )}
            </div>
          </div>

          

          {/* Tab bar — variant="chip" made explicit 2026-08-24. This was
              relying on PillTabs' default ('pill'), which used to look
              close enough to 'chip' by coincidence (both were content-
              hugging separate pills). 'pill' is now a full-width segmented
              control instead (see PillTabs' own header comment) — right
              for a 2-3-option toggle, wrong for these 6 scrollable tabs,
              which stretched into evenly-spaced, oddly-gapped pills once
              'pill' started spanning the full row. 'chip' is what this
              always actually was: a compact, scrollable, content-hugging
              strip. */}
          <PillTabs
            tabs={TABS}
            value={activeTab}
            onChange={setActiveTab}
            getKey={(t) => t}
            getLabel={(t) => TAB_LABELS[t]}
            variant="chip"
            scrollable
            className="-mx-1 px-1"
          />

          <div>
            {activeTab === 'profile' && <ProfileTab customer={customer} />}
            {activeTab === 'edit'    && <EditTab customer={customer} onSaved={handleSaved} />}
            {activeTab === 'schemes' && <SchemesTab customerId={customer.customerId} />}
            {activeTab === 'points'  && <PointsTab customerId={customer.customerId} />}
            {activeTab === '360'     && <Customer360Tab customerId={customer.customerId} />}
            {activeTab === 'wishlist' && <WishlistTab customerId={customer.customerId} />}
          </div>

        </div>
      )}
    </div>
  );
}
