'use client';

// src/app/(pos)/transfers/page.jsx
// Phase 11 — Transfers (informational placeholder).
//
// Direct inter-store stock transfer endpoints (initiate, view requests,
// approve/reject, history, status tracking) are Not Available In Current
// API Collection (OrnaVerse Advantage API v3.0).
//
// Available workaround: GetStockByStores (cross-store stock visibility),
// surfaced on Product Detail via CrossStoreStockPanel — lets managers see
// which store holds stock and arrange a manual transfer.

import Link from 'next/link';
import { ArrowLeftRight, Search, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TransfersPage() {
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="relative -mx-4 -mt-4 flex items-center justify-between bg-background px-4 pt-4 pb-2 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <h1 className="text-base font-bold text-stone-800">Transfers</h1>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <ArrowLeftRight size={40} className="text-muted-foreground/50" aria-hidden="true" strokeWidth={1.5} />

        <div className="space-y-1.5 max-w-md">
          <p className="text-sm font-medium text-foreground">
            Inter-store stock transfers are not available yet
          </p>
          <p className="text-xs text-muted-foreground">
            Direct stock transfer requests, approvals, and tracking between
            Lucira store locations are managed through the OrnaVerse backend
            and are not yet exposed in the current API collection. This
            screen will be expanded into a full transfer workflow once those
            endpoints become available.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-stone-50 px-6 py-6">
        <div className="flex items-center gap-2">
          <Boxes size={18} className="text-stone-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-800">
            Available workaround: Cross-store stock visibility
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          You can check how much stock of an item is available across all
          Lucira stores from any product&apos;s detail page. Use this to
          identify which store has the stock you need and coordinate a
          manual transfer.
        </p>
        <div>
          <Button asChild size="sm" className="gap-2">
            <Link href="/catalog">
              <Search size={16} aria-hidden="true" />
              Search Catalog for Stock by Store
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}