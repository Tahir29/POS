'use client';

// src/app/(pos)/invoices/page.jsx
// Invoice directory — paginated browse + full-dataset search/filter.
//
// Search/filter behavior (mirrors /orders pattern):
//   - Any text (2+ chars) or date range triggers a filter over the full
//     invoices dataset (useAllInvoices — fetched once with Take:0, cached).
//   - Empty search + no dates shows the paginated browse list via useInvoiceList.
//   - Pagination is hidden while any filter is active.
//   - A single Clear button resets all active filters at once.

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Receipt, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InvoiceListItem from '@/components/features/invoices/InvoiceListItem';
import InvoiceDetailSheet from '@/components/features/invoices/InvoiceDetailSheet';
import { useInvoiceList } from '@/hooks/invoices/useInvoiceList';
import { useAllInvoices } from '@/hooks/invoices/useAllInvoices';
import APP_CONFIG from '@/constants/appConfig';

export default function InvoicesPage() {
  const [skip, setSkip] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [inputVal, setInputVal]       = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // debounced
  const [fromDate, setFromDate]       = useState('');
  const [toDate, setToDate]           = useState('');

  const debounceRef = useRef(null);

  // ── Paginated browse (shown when no filter active) ───────
  const {
    invoices: pagedInvoices,
    totalCount,
    take,
    isLoading: isPagedLoading,
    isFetching: isPagedFetching,
    isError: isPagedError,
    refetch,
  } = useInvoiceList({ skip });

  // ── Full dataset for filtering ───────────────────────────
  const {
    allInvoices,
    isLoading: isAllLoading,
    isFetching: isAllFetching,
  } = useAllInvoices();

  // ── Debounced search ─────────────────────────────────────
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setInputVal(val);
    clearTimeout(debounceRef.current);
    if (val.trim() === '') {
      setSearchQuery('');
      return;
    }
    debounceRef.current = setTimeout(
      () => setSearchQuery(val),
      APP_CONFIG.SEARCH.DEBOUNCE_MS
    );
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleClearAll = () => {
    clearTimeout(debounceRef.current);
    setInputVal('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  // ── Filter logic ─────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const isSearchActive =
    q.length >= APP_CONFIG.SEARCH.MIN_QUERY_LENGTH || !!fromDate || !!toDate;

  const filteredInvoices = useMemo(() => {
    if (!isSearchActive) return [];

    let result = allInvoices;

    if (q.length >= APP_CONFIG.SEARCH.MIN_QUERY_LENGTH) {
      result = result.filter((inv) => {
        const invoiceNo  = inv.invoiceNo?.toLowerCase() ?? '';
        const customer   = inv.customerName?.toLowerCase() ?? '';
        return invoiceNo.includes(q) || customer.includes(q);
      });
    }

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      result = result.filter(
        (inv) => inv.invoiceDate && new Date(inv.invoiceDate) >= from
      );
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter(
        (inv) => inv.invoiceDate && new Date(inv.invoiceDate) <= to
      );
    }

    return result;
  }, [allInvoices, q, fromDate, toDate, isSearchActive]);

  // ── Display resolution ───────────────────────────────────
  const displayInvoices = isSearchActive ? filteredInvoices : pagedInvoices;

  const isFilterBusy = isSearchActive && isAllLoading && allInvoices.length === 0;
  const isLoading    = isSearchActive ? isFilterBusy : isPagedLoading;
  const isError      = isSearchActive ? false : isPagedError;
  const hasFilters   = !!inputVal || !!fromDate || !!toDate;

  const totalPages  = Math.max(1, Math.ceil(totalCount / take));
  const currentPage = Math.floor(skip / take) + 1;

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
      <div className="relative -mx-4 -mt-4 flex items-center justify-between bg-background px-4 pt-4 pb-2 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <h1 className="text-3xl font-bold text-stone-800">Invoices</h1>
        {isAllFetching && !isAllLoading && (
          <Loader2 size={14} className="animate-spin text-stone-400" aria-hidden="true" />
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Search input */}
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <Input
            type="search"
            placeholder="Search by invoice number or customer"
            value={inputVal}
            onChange={handleSearchChange}
            className="pl-9 pr-9"
            aria-label="Search invoices"
          />
          {inputVal.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearTimeout(debounceRef.current);
                setInputVal('');
                setSearchQuery('');
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Date range + Clear — stacked on mobile, inline on md+ */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="date"
              value={fromDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="flex-1 min-w-0"
            />
            <span className="text-stone-400 text-sm shrink-0">to</span>
            <Input
              type="date"
              value={toDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="flex-1 min-w-0"
            />
          </div>

          {/* Clear all */}
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="gap-1.5 shrink-0 w-full md:w-auto"
              aria-label="Clear all filters"
            >
              <X size={14} aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>

        {/* Active filter summary */}
        {isSearchActive && !isFilterBusy && (
          <p className="text-xs text-stone-500">
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* ── List ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500 col-span-full">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {isSearchActive ? 'Searching invoices…' : 'Loading invoices…'}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center col-span-full">
            <p className="text-sm text-destructive">Failed to load invoices.</p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : displayInvoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-stone-500 col-span-full">
            <Receipt size={28} aria-hidden="true" className="text-stone-300" />
            <p className="text-sm">
              {isSearchActive ? 'No invoices match your filters.' : 'No invoices found.'}
            </p>
          </div>
        ) : (
          displayInvoices.map((invoice, idx) => (
            <InvoiceListItem
              key={invoice.raw?.transaction_item_id ?? idx}
              invoice={invoice}
              onSelect={() => setSelectedInvoice(invoice)}
            />
          ))
        )}
      </div>

      {/* ── Pagination — hidden while any filter is active ── */}
      {!isSearchActive && totalCount > take && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSkip((s) => Math.max(0, s - take))}
            disabled={skip === 0 || isPagedFetching}
            aria-label="Previous page"
            className="h-9 w-9"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="text-xs text-stone-500">
            {skip + 1}–{Math.min(skip + take, totalCount)} of {totalCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSkip((s) => s + take)}
            disabled={skip + take >= totalCount || isPagedFetching}
            aria-label="Next page"
            className="h-9 w-9"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      <InvoiceDetailSheet
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
}