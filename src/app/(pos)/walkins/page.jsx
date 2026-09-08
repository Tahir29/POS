'use client';

// Walk-ins directory — every real customer match logged via
// useWalkInLookup.js's own Mongo write (see lib/mongo/walkins.js's header
// for why this exists at all: OrnaVerse's WalkIn/Lookup and /Register are
// both single-customer, mobile-keyed calls with no listing mode — nothing
// server-side to browse, so this app keeps its own log).
//
// SCOPED TO THE ACTIVE STORE, always — company_id travels straight from
// Redux (selectActiveStoreId) into the query key (useWalkInsList), so
// switching stores in the header re-queries for the new store
// automatically; no extra logic needed here (see useWalkInsList's own
// header for why: switchStore already clears the whole React Query cache
// on every switch).
//
// Date filter mirrors invoices/orders' own pattern exactly — two native
// <input type="date"> fields, no separate DateRangePicker component exists
// anywhere in this app to reach for instead. Unlike those two pages,
// filtering happens SERVER-SIDE (the Mongo query itself takes from/to —
// see api/customers/walkins/route.js), not over a full pre-fetched
// dataset — there's no "browse everything, filter client-side" mode here,
// since a store's walk-in log has no natural page size to cap it at up
// front the way an invoice/order list does.
//
// READ-ONLY BY DESIGN — walkInCustomerId here is a CRM-level id, NOT a
// party_id (see normalizeWalkInCustomer's own warning), so this list
// deliberately offers no "Attach"/"View Profile" action: there's no real
// billing identity to safely jump to from this data alone. It exists to
// surface contact info (name + mobile) for retargeting outside the app,
// not to re-enter a sale from here.

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Footprints, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import InlineLoader from '@/components/shared/InlineLoader';
import { StaggerList } from '@/components/shared/StaggerList';
import { useWalkInsList } from '@/hooks/customer/useWalkInsList';
import { selectActiveStoreId, selectActiveStoreName } from '@/store/slices/storeSlice';
import { todayDateString } from '@/lib/dateUtils';

function fmtVisitedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function WalkInRow({ walkIn }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {walkIn.customerName ?? 'Unknown customer'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {walkIn.mobile ?? '—'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground shrink-0 text-right">
        {fmtVisitedAt(walkIn.createdAt)}
      </p>
    </div>
  );
}

export default function WalkInsPage() {
  const companyId   = useSelector(selectActiveStoreId);
  const companyName = useSelector(selectActiveStoreName);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const hasFilters = !!fromDate || !!toDate;

  const { items, isLoading, isError, refetch } = useWalkInsList(companyId, { fromDate, toDate });

  const handleClearAll = () => {
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full p-4 md:p-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Walk-ins</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {companyName ? `Logged for ${companyName}` : 'Logged for the active store'}
        </p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex items-center gap-2 flex-1">
          <Input
            type="date"
            value={fromDate}
            max={todayDateString()}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="flex-1 min-w-0"
          />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
          <Input
            type="date"
            value={toDate}
            max={todayDateString()}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="flex-1 min-w-0"
          />
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="gap-1.5 shrink-0 w-full md:w-auto"
            aria-label="Clear date filter"
          >
            <X size={14} aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      {!isLoading && !isError && (
        <p className="text-xs text-muted-foreground -mt-1">
          {items.length} walk-in{items.length !== 1 ? 's' : ''}{hasFilters ? ' in this range' : ''}
        </p>
      )}

      <StaggerList className="flex flex-col gap-1.5">
        {isLoading ? (
          <InlineLoader label="Loading walk-ins…" />
        ) : isError ? (
          <ErrorState title="Failed to load walk-ins." onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Footprints}
            title={hasFilters ? 'No walk-ins in this range.' : 'No walk-ins logged yet.'}
            description={
              hasFilters
                ? undefined
                : 'A walk-in is logged automatically the first time a customer is matched by mobile search at this store.'
            }
          />
        ) : (
          items.map((walkIn) => (
            <WalkInRow key={walkIn._id ?? `${walkIn.mobile}-${walkIn.createdAt}`} walkIn={walkIn} />
          ))
        )}
      </StaggerList>
    </div>
  );
}
