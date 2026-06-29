// src/app/(pos)/transactions/page.jsx
'use client';

// PHASE 22 — Transactions Module
//
// Single tabbed page covering all 6 POS transaction types:
//   Returns | Refunds | Credit Notes | Exchange | Buyback | URD Purchase
//
// ARCHITECTURE:
//   - One tab per transaction type, lazy-loaded on first tab activation
//   - Each tab renders a TransactionList (shared) fed by the matching hook
//   - Tapping a row opens TransactionDetailSheet (shared) with raw fields
//   - No create forms in this phase — lists + detail view only
//     (Create flows require confirmed request shapes from real Postman
//      responses before forms can be built safely)
//
// SCHEMA FACTS:
//   - All transaction rows share: transaction_id, document_no,
//     document_date, party_id, party_name, net_amount
//   - normalizeTransaction (from useTransactionLists) maps these to:
//     transactionId, documentNo, documentDate, customerId,
//     customerName, amount
//   - "NA" string values already nulled out by normalizer

import { Suspense, useState, useCallback } from 'react';
import { useSelector }                     from 'react-redux';
import {
  RotateCcw,
  CreditCard,
  FileText,
  ArrowLeftRight,
  ShoppingBag,
  Coins,
  ChevronRight,
  RefreshCw,
  X,
  Calendar,
  User,
  Hash,
  IndianRupee,
}                                          from 'lucide-react';

import {
  useReturns,
  useRefunds,
  useCreditNotes,
  useExchanges,
  useBuybacks,
  useURDPurchases,
}                                          from '@/hooks/transactions/useTransactionLists';
import PageLoader                          from '@/components/shared/PageLoader';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  {
    id:    'returns',
    label: 'Returns',
    icon:  RotateCcw,
    hook:  useReturns,
    emptyMessage: 'No return transactions found.',
  },
  {
    id:    'refunds',
    label: 'Refunds',
    icon:  CreditCard,
    hook:  useRefunds,
    emptyMessage: 'No refund transactions found.',
  },
  {
    id:    'credit-notes',
    label: 'Credit Notes',
    icon:  FileText,
    hook:  useCreditNotes,
    emptyMessage: 'No credit notes found.',
  },
  {
    id:    'exchange',
    label: 'Exchange',
    icon:  ArrowLeftRight,
    hook:  useExchanges,
    emptyMessage: 'No exchange transactions found.',
  },
  {
    id:    'buyback',
    label: 'Buyback',
    icon:  ShoppingBag,
    hook:  useBuybacks,
    emptyMessage: 'No buyback transactions found.',
  },
  {
    id:    'urd',
    label: 'URD Purchase',
    icon:  Coins,
    hook:  useURDPurchases,
    emptyMessage: 'No URD purchase transactions found.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

// ─── Transaction Detail Sheet ─────────────────────────────────────────────────

function TransactionDetailSheet({ transaction, onClose }) {
  if (!transaction) return null;

  const raw = transaction.raw ?? {};

  // Build detail rows from raw API fields — avoids hardcoding assumptions
  // about which fields each transaction type has beyond the shared header.
  const headerRows = [
    { icon: Hash,         label: 'Document No',  value: transaction.documentNo    ?? '—' },
    { icon: Calendar,     label: 'Date',          value: formatDate(transaction.documentDate) },
    { icon: User,         label: 'Customer',      value: transaction.customerName  ?? '—' },
    { icon: IndianRupee,  label: 'Amount',        value: formatINR(transaction.amount) },
  ];

  // Additional raw fields (exclude header fields already shown + internal ones)
  const skipKeys = new Set([
    'transaction_id', 'document_no', 'document_date',
    'party_id', 'party_name', 'net_amount',
    'company_id', 'current_company_id',
  ]);

  const extraRows = Object.entries(raw)
    .filter(([k, v]) =>
      !skipKeys.has(k) &&
      v !== null &&
      v !== undefined &&
      v !== 'NA' &&
      v !== '' &&
      typeof v !== 'object'
    )
    .map(([k, v]) => ({
      label: k.replace(/_/g, ' '),
      value: String(v),
    }));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-background border-l border-border z-50 flex flex-col shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">Transaction</p>
            <p className="text-sm font-semibold text-foreground">
              {transaction.documentNo ?? `#${transaction.transactionId}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

          {/* Header fields */}
          <div className="bg-muted/30 rounded-xl p-4 flex flex-col gap-3">
            {headerRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground break-words">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Extra raw fields */}
          {extraRows.length > 0 && (
            <div className="flex flex-col gap-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Additional Details
              </p>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {extraRows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="text-xs text-muted-foreground capitalize">{label}</p>
                    <p className="text-xs font-medium text-foreground text-right max-w-[55%] break-words">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TransactionRow({ item, onSelect }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {item.documentNo ?? `#${item.transactionId}`}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.customerName ?? 'Unknown customer'}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(item.documentDate)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {formatINR(item.amount)}
        </p>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}

// ─── Transaction List ─────────────────────────────────────────────────────────

function TransactionList({ hook: useHook, emptyMessage }) {
  const [skip, setSkip]         = useState(0);
  const [selected, setSelected] = useState(null);

  const { items, totalCount, take, isLoading, isFetching, isError, refetch } =
    useHook({ skip });

  const totalPages  = Math.max(1, Math.ceil(totalCount / take));
  const currentPage = Math.floor(skip / take) + 1;

  const handlePrev = useCallback(() => setSkip((s) => Math.max(0, s - take)), [take]);
  const handleNext = useCallback(() => setSkip((s) => s + take), [take]);

  if (isLoading) return <ListSkeleton />;

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">Failed to load transactions.</p>
      <button
        onClick={refetch}
        className="flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  );

  if (!items.length) return (
    <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>
  );

  return (
    <>
      {/* Fetching indicator */}
      {isFetching && !isLoading && (
        <div className="flex justify-center py-2">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border overflow-hidden">
        {items.map((item) => (
          <TransactionRow
            key={item.transactionId ?? item.documentNo}
            item={item}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handlePrev}
            disabled={skip === 0}
            className="text-xs font-medium text-primary disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <button
            onClick={handleNext}
            disabled={currentPage >= totalPages}
            className="text-xs font-medium text-primary disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <TransactionDetailSheet
          transaction={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0"
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ tabs, activeId, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
              whitespace-nowrap transition-colors shrink-0
              ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function TransactionsScreen() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const storeId = useSelector((state) => state.store.activeStoreId);

  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Transactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Returns, refunds, and post-sale activity
        </p>
      </div>

      {/* No store guard */}
      {!storeId && (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No store selected. Please switch to a store to view transactions.
          </p>
        </div>
      )}

      {storeId && (
        <>
          {/* Tab bar */}
          <TabBar
            tabs={TABS}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id)}
          />

          {/* Active tab content */}
          <TransactionList
            key={activeTab}
            hook={activeTabConfig.hook}
            emptyMessage={activeTabConfig.emptyMessage}
          />
        </>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TransactionsScreen />
    </Suspense>
  );
}