'use client';

// src/app/(pos)/invoices/page.jsx
// Invoice directory — paginated list with detail/print drill-down.
//
// Maps to: POST Services/POS/Invoice/List (paginated)
//          POST Services/POS/Invoice/Retrieve (detail, reuses Phase 9b
//          useInvoiceDetail / PrintInvoiceButton)
//
// Field names for both endpoints are per API_MAPPING.md's "expected
// fields" — UNCONFIRMED. See useInvoiceList.js for normalization notes.
// This same list/detail pattern is intended to be reused for the
// /orders page once POS_CHANNEL_ID is resolved and Order/Generate can be
// tested end-to-end.

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InvoiceListItem from '@/components/features/invoices/InvoiceListItem';
import InvoiceDetailSheet from '@/components/features/invoices/InvoiceDetailSheet';
import { useInvoiceList } from '@/hooks/invoices/useInvoiceList';

export default function InvoicesPage() {
  const [skip, setSkip] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  const { invoices, totalCount, take, isLoading, isFetching, isError, refetch } = useInvoiceList({ skip });

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between bg-background px-4 pt-4 pb-2 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <h1 className="text-base font-bold text-stone-800">Invoices</h1>
      </div>

      <div className="flex flex-col gap-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Loading invoices…
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive">Failed to load invoices.</p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-stone-500">
            <Receipt size={28} aria-hidden="true" className="text-stone-300" />
            <p className="text-sm">No invoices found.</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <InvoiceListItem
              key={invoice.invoiceId}
              invoice={invoice}
              onSelect={() => setSelectedInvoiceId(invoice.invoiceId)}
            />
          ))
        )}
      </div>

      {totalCount > take && (
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setSkip((s) => Math.max(0, s - take))}
            disabled={skip === 0 || isFetching}
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
            disabled={skip + take >= totalCount || isFetching}
            aria-label="Next page"
            className="h-9 w-9"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      <InvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        isOpen={!!selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
      />
    </div>
  );
}