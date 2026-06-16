'use client';

// src/app/(pos)/orders/page.jsx
// Orders directory — paginated browse + full-dataset search/filter.
//
// Search/filter behavior (mirrors /customers pattern):
//   - Any text (2+ chars) or date range triggers a filter over the full
//     orders dataset (useAllOrders — fetched once with Take:0, cached).
//   - Empty search + no dates shows the paginated browse list (50/page
//     via useOrders).
//   - Pagination is hidden while any filter is active — the filtered
//     result IS the full result, page count is meaningless.
//   - A single Clear button resets all active filters at once.
//
// This avoids the page-1-only search problem: if an order is on page 4
// and the user searches on page 1, useAllOrders already has all records
// in memory so the result is found correctly.

import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Receipt, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OrderListItem from '@/components/features/orders/OrderListItem';
import OrderDetailSheet from '@/components/features/orders/OrderDetailSheet';
import { useOrders } from '@/hooks/orders/useOrders';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import APP_CONFIG from '@/constants/appConfig';

export default function OrdersPage() {
  const [skip, setSkip] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Raw input state
  const [inputVal, setInputVal]   = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // debounced
  const [fromDate, setFromDate]   = useState('');
  const [toDate, setToDate]       = useState('');

  const debounceRef = useRef(null);

  // ── Paginated browse list (shown when no filter active) ──
  const {
    orders: pagedOrders,
    totalCount,
    take,
    isLoading: isPagedLoading,
    isFetching: isPagedFetching,
    isError: isPagedError,
    refetch,
  } = useOrders({ skip });

  // ── Full dataset (always fetching in background, ready for filtering) ──
  const {
    allOrders,
    isLoading: isAllLoading,
    isFetching: isAllFetching,
  } = useAllOrders();

  // ── Debounced search input ───────────────────────────────
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

  const filteredOrders = useMemo(() => {
    if (!isSearchActive) return [];

    let result = allOrders;

    if (q.length >= APP_CONFIG.SEARCH.MIN_QUERY_LENGTH) {
      result = result.filter((order) => {
        const orderNo = order.orderNo?.toLowerCase() ?? '';
        const customer = order.customerName?.toLowerCase() ?? '';
        return orderNo.includes(q) || customer.includes(q);
      });
    }

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      result = result.filter(
        (order) => order.orderDate && new Date(order.orderDate) >= from
      );
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      result = result.filter(
        (order) => order.orderDate && new Date(order.orderDate) <= to
      );
    }

    return result;
  }, [allOrders, q, fromDate, toDate, isSearchActive]);

  // ── Display resolution ───────────────────────────────────
  const displayOrders = isSearchActive ? filteredOrders : pagedOrders;

  // While search/filter is active and the full list is still loading
  const isFilterBusy  = isSearchActive && isAllLoading && allOrders.length === 0;
  const isLoading     = isSearchActive ? isFilterBusy : isPagedLoading;
  const isError       = isSearchActive ? false : isPagedError;
  const hasFilters    = !!inputVal || !!fromDate || !!toDate;

  const totalPages  = Math.max(1, Math.ceil(totalCount / take));
  const currentPage = Math.floor(skip / take) + 1;

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
      <div className="relative -mx-4 -mt-4 flex items-center justify-between bg-background px-4 pt-4 pb-2 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <h1 className="text-base font-bold text-stone-800">Orders</h1>
        {/* Background fetch indicator */}
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
            placeholder="Search by order number or customer"
            value={inputVal}
            onChange={handleSearchChange}
            className="pl-9 pr-9"
            aria-label="Search orders"
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

        {/* Date range + clear button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="flex-1 min-w-0"
            />
            <span className="text-stone-400 text-sm shrink-0">to</span>
            <Input
              type="date"
              value={toDate}
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
              className="gap-1.5 shrink-0"
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
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* ── List ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500 col-span-full">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {isSearchActive ? 'Searching orders…' : 'Loading orders…'}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center col-span-full">
            <p className="text-sm text-destructive">Failed to load orders.</p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-stone-500 col-span-full">
            <Receipt size={28} aria-hidden="true" className="text-stone-300" />
            <p className="text-sm">
              {isSearchActive ? 'No orders match your filters.' : 'No orders found.'}
            </p>
          </div>
        ) : (
          displayOrders.map((order, idx) => (
            <OrderListItem
              key={order.orderId ?? idx}
              order={order}
              onSelect={() => setSelectedOrder(order)}
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
            size="sm"
            onClick={() => setSkip((s) => Math.max(0, s - take))}
            disabled={skip === 0 || isPagedFetching}
            className="gap-1"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className="text-xs text-stone-500">
            Page {currentPage} of {totalPages} · {totalCount} orders
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSkip((s) => s + take)}
            disabled={skip + take >= totalCount || isPagedFetching}
            className="gap-1"
            aria-label="Next page"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      <OrderDetailSheet
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}