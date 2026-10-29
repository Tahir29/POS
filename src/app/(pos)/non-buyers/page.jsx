'use client';

import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Search, X, Loader2, RefreshCw, Download, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import { StaggerList } from '@/components/shared/StaggerList';
import NonBuyerListItem from '@/components/features/nonBuyers/NonBuyerListItem';
import NonBuyerDetailSheet from '@/components/features/nonBuyers/NonBuyerDetailSheet';
import { useNonBuyerSources } from '@/hooks/customer/useNonBuyerSources';
import { deriveNonBuyers } from '@/lib/nonBuyers/deriveNonBuyers';
import { selectActiveStoreId, selectActiveStoreName } from '@/store/slices/storeSlice';
import { todayDateString, formatDatePadded } from '@/lib/dateUtils';
import { formatMobileWithCountryCode } from '@/lib/phoneFormat';
import { downloadXlsx } from '@/lib/excelExport';

const PAGE_SIZE = 48;
// Default look-back: recent enough that a follow-up call still makes sense.
const DEFAULT_LOOKBACK_DAYS = 90;

const MIN_VISIT_OPTIONS = [
  { value: '1', label: '1+ visits' },
  { value: '2', label: '2+ visits' },
  { value: '3', label: '3+ visits' },
  { value: '5', label: '5+ visits' },
];

const SORT_OPTIONS = [
  { value: 'visits', label: 'Most visits' },
  { value: 'recent', label: 'Latest visit' },
];

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - DEFAULT_LOOKBACK_DAYS);
  return localDateString(d);
}

const EXPORT_COLUMNS = [
  { key: 'name',             label: 'Name' },
  { key: 'mobile',           label: 'Mobile' },
  { key: 'email',            label: 'Email' },
  { key: 'visitCount',       label: 'Visits' },
  { key: 'firstVisit',       label: 'First visit' },
  { key: 'lastVisit',        label: 'Last visit' },
  { key: 'daysSince',        label: 'Days since last visit' },
  { key: 'sources',          label: 'Sources' },
  { key: 'pastBuyer',        label: 'Past buyer' },
  { key: 'lastPurchase',     label: 'Last purchase' },
  { key: 'cancelledOrder',   label: 'Cancelled order' },
];

export default function NonBuyersPage() {
  const companyId   = useSelector(selectActiveStoreId);
  const companyName = useSelector(selectActiveStoreName);

  const [search, setSearch]       = useState('');
  const [fromDate, setFromDate]   = useState(defaultFromDate);
  const [toDate, setToDate]       = useState('');
  const [minVisits, setMinVisits] = useState('2');
  const [sortBy, setSortBy]       = useState('visits');
  const [selected, setSelected]   = useState(null);

  const { visits, documents, isLoading, isFetching, isError, refetch } = useNonBuyerSources(companyId);

  const nonBuyers = useMemo(
    () => deriveNonBuyers({ visits, documents, fromDate, toDate, minVisits: Number(minVisits) }),
    [visits, documents, fromDate, toDate, minVisits],
  );

  const trimmedSearch = search.trim().toLowerCase();
  const searchDigits = trimmedSearch.replace(/\D/g, '');
  const filtered = useMemo(() => {
    const matching = trimmedSearch
      ? nonBuyers.filter((n) =>
          n.name?.toLowerCase().includes(trimmedSearch)
          || (searchDigits.length >= 3 && String(n.mobile ?? '').replace(/\D/g, '').includes(searchDigits)))
      : nonBuyers;
    if (sortBy === 'recent') {
      return [...matching].sort((a, b) => new Date(b.lastVisitAt) - new Date(a.lastVisitAt));
    }
    return matching; // deriveNonBuyers already sorts by most visits
  }, [nonBuyers, trimmedSearch, searchDigits, sortBy]);

  // Reset paging whenever the result set changes (same render-time pattern
  // as the Buyers page — no effect, no flash of the old page size).
  const filterKey = `${fromDate}|${toDate}|${minVisits}|${sortBy}|${trimmedSearch}|${filtered.length}`;
  const [pagination, setPagination] = useState({ key: filterKey, visibleCount: PAGE_SIZE });
  if (pagination.key !== filterKey) {
    setPagination({ key: filterKey, visibleCount: PAGE_SIZE });
  }
  const visibleCount = pagination.key === filterKey ? pagination.visibleCount : PAGE_SIZE;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const pastBuyerCount = filtered.filter((n) => n.isPastBuyer).length;
  const hasDateFilter = !!fromDate || !!toDate;

  const handleExport = () => {
    const rows = filtered.map((n) => ({
      name:           n.name ?? '',
      mobile:         n.mobile ? formatMobileWithCountryCode(n.mobile) : '',
      email:          n.email ?? '',
      visitCount:     n.visitCount,
      firstVisit:     formatDatePadded(n.firstVisitAt),
      lastVisit:      formatDatePadded(n.lastVisitAt),
      daysSince:      n.daysSinceLastVisit ?? '',
      sources:        n.sources.join(', '),
      pastBuyer:      n.isPastBuyer ? 'Yes' : 'No',
      lastPurchase:   n.lastPurchaseDate ? formatDatePadded(n.lastPurchaseDate) : '',
      cancelledOrder: n.hasCancelledOrder ? 'Yes' : 'No',
    }));
    const range = `${fromDate || 'start'}_to_${toDate || todayDateString()}`;
    downloadXlsx(`non-buyers_${range}.xlsx`, [{ name: 'Non-Buyers', columns: EXPORT_COLUMNS, rows }]);
  };

  return (
    <div className="flex flex-col gap-4 w-full p-4 md:p-6">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pt-4 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div>
          <h1 className="text-lg font-bold text-foreground">Non-Buyers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Walk-ins at {companyName ?? 'this store'} who visited but haven&rsquo;t bought since their first visit in the period.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative lg:flex-1 lg:min-w-56">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              inputMode="search"
              placeholder="Search by name or mobile number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full pl-9 pr-9"
              aria-label="Search non-buyers"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={fromDate}
              max={toDate || todayDateString()}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="h-11 flex-1 min-w-0 lg:w-38 lg:flex-none"
            />
            <span className="text-muted-foreground text-sm shrink-0">to</span>
            <Input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={todayDateString()}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="h-11 flex-1 min-w-0 lg:w-38 lg:flex-none"
            />
            {hasDateFilter && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => { setFromDate(''); setToDate(''); }}
                aria-label="Show all dates"
                className="h-11 w-11 shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select value={minVisits} onValueChange={setMinVisits}>
              <SelectTrigger className="h-11 flex-1 lg:w-32 lg:flex-none" aria-label="Minimum visits">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {MIN_VISIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-11 flex-1 lg:w-36 lg:flex-none" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleExport}
              disabled={isLoading || filtered.length === 0}
              aria-label="Export to Excel"
              className="h-11 w-11 shrink-0"
            >
              <Download size={16} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="h-11 w-11 shrink-0"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {!isLoading && !isError && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} non-buyer{filtered.length !== 1 ? 's' : ''}
            {pastBuyerCount > 0 ? ` · ${pastBuyerCount} bought here before` : ''}
            {hasDateFilter ? '' : ' · all dates'}
          </p>
        )}
      </div>

      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Matching walk-ins against orders and invoices…
          </div>
        ) : isError ? (
          <ErrorState
            className="col-span-full"
            title="Couldn't load walk-ins or orders."
            onRetry={() => refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            className="col-span-full"
            icon={UserX}
            title={trimmedSearch ? 'No matching non-buyers.' : 'No non-buyers for these filters.'}
            description={trimmedSearch ? undefined : 'Try fewer minimum visits or a wider date range.'}
          />
        ) : (
          visible.map((nonBuyer) => (
            <NonBuyerListItem
              key={nonBuyer.key}
              nonBuyer={nonBuyer}
              onSelect={() => setSelected(nonBuyer)}
            />
          ))
        )}
      </StaggerList>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPagination((prev) => ({ ...prev, visibleCount: prev.visibleCount + PAGE_SIZE }))}
          >
            Show more ({filtered.length - visibleCount} left)
          </Button>
        </div>
      )}

      <NonBuyerDetailSheet
        nonBuyer={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
