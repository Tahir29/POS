// src/app/(pos)/reports/page.jsx
'use client';

// PHASE 21 — Reports Module
//
// Four report cards, all derived from existing list endpoints.
// No dedicated reporting endpoints exist in the API — reports are
// aggregated client-side from the same list APIs used elsewhere.
//
// REPORTS AVAILABLE:
//   1. Orders Summary      — useAllOrders (ORDERS.LIST Take:0 cache)
//   2. Invoice Report      — axiosInstance → INVOICES.LIST (safe Take:300)
//   3. POS Receipts        — reportsService.getPOSReceiptsReport (real endpoint)
//   4. Sales (Weekly)      — reportsService.getWeeklySales (real endpoint)
//
// REPORTS NOT AVAILABLE (no endpoint):
//   - Metal Rate History   (no list/history endpoint in v1.json)
//   - Sales by Category    (no breakdown endpoint in v1.json)
//   - Stock Summary        (ProductCatalog/List works but Take:0 = 0 records
//                           on Serenity; large Take needed — deferred)
//   - Scheme Enrollment    (SchemeEnrollment/List 500 on UAT — known blocker)
//
// SCHEMA FACTS (never assume):
//   - OrderRow:   status DERIVED from balance_amount + receipt_amount
//                 normalizeCustomerOrder maps → { totalAmount (net_amount),
//                 status (APP_CONFIG.ORDER_STATUS.*), orderDate, customerName }
//   - InvoiceRow: net_amount (NOT gross_amount). No gross_amount field.
//   - Take:0 on Serenity = 0 records — always use explicit Take for invoices.

import { Suspense, useMemo } from 'react';
import { useQuery }          from '@tanstack/react-query';
import { useSelector }       from 'react-redux';
import {
  ShoppingBag,
  FileText,
  Receipt,
  TrendingUp,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Ban,
  Printer,
} from 'lucide-react';

import { useAllOrders }                from '@/hooks/orders/useAllOrders';
import axiosInstance                   from '@/lib/axios/axiosInstance';
import {
  getPOSReceiptsReport,
  getWeeklySales,
}                                      from '@/services/reportsService';
import API                             from '@/constants/apiEndpoints';
import { QUERY_KEYS }                  from '@/constants/queryKeys';
import APP_CONFIG                      from '@/constants/appConfig';
import PageLoader                      from '@/components/shared/PageLoader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
}

// ─── Orders Summary ───────────────────────────────────────────────────────────
// Reuses the ORDERS.LIST(take:0) cache — no extra network call if /orders
// was visited first. normalizeCustomerOrder already derives status from
// balance_amount + receipt_amount using APP_CONFIG.ORDER_STATUS constants.

function OrdersSummaryReport() {
  const { allOrders, isLoading, isError, refetch } = useAllOrders();

  const stats = useMemo(() => {
    if (!allOrders.length) return null;

    let totalValue = 0;
    let paid = 0, partial = 0, due = 0;

    for (const o of allOrders) {
      totalValue += Number(o.totalAmount) || 0;
      if (o.status === APP_CONFIG.ORDER_STATUS.PAID)    paid++;
      else if (o.status === APP_CONFIG.ORDER_STATUS.PARTIAL) partial++;
      else if (o.status === APP_CONFIG.ORDER_STATUS.DUE)    due++;
    }

    return { total: allOrders.length, totalValue, paid, partial, due };
  }, [allOrders]);

  if (isLoading) return <ReportSkeleton />;
  if (isError)   return <ReportError message="Failed to load orders." onRetry={refetch} />;
  if (!stats)    return <ReportEmpty message="No orders found." />;

  return (
    <div className="flex flex-col gap-3">
      <StatRow
        icon={<ShoppingBag className="w-4 h-4" />}
        label="Total Orders"
        value={stats.total}
      />
      <StatRow
        icon={<IndianRupee className="w-4 h-4" />}
        label="Total Value"
        value={formatINR(stats.totalValue)}
        highlight
      />
      <div className="border-t border-border pt-3 flex flex-col gap-3">
        <StatRow
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          label="Paid"
          value={stats.paid}
        />
        <StatRow
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          label="Partial"
          value={stats.partial}
        />
        <StatRow
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          label="Due"
          value={stats.due}
        />
      </div>
    </div>
  );
}

// ─── Invoice Report ───────────────────────────────────────────────────────────
// Uses INVOICES.ALL(storeId) key — matches the pattern used by useAllInvoices
// if/when that hook is created. Take:300 is safe (Serenity: Take:0 = 0 records).
// Amount field: net_amount only — NO gross_amount on InvoiceRow.

function InvoiceReport({ storeId }) {
  const query = useQuery({
    queryKey: QUERY_KEYS.INVOICES.ALL(storeId),
    queryFn: async () => {
      const response = await axiosInstance.post(API.INVOICES.LIST, {
        current_company_id: storeId,
        Take: 300,
        Skip: 0,
      });
      const data     = response?.data;
      const entities = data?.Entities ?? [];
      const total    = data?.TotalCount ?? entities.length;
      const value    = entities.reduce(
        (sum, e) => sum + (Number(e.net_amount) || 0),
        0
      );
      const uniqueNos = new Set(
        entities.map((e) => e.document_no).filter(Boolean)
      ).size;
      return { total, value, uniqueNos };
    },
    enabled:   !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  if (!storeId)      return <ReportEmpty message="No store selected." />;
  if (query.isLoading) return <ReportSkeleton />;
  if (query.isError)   return <ReportError message="Failed to load invoices." onRetry={query.refetch} />;

  const d = query.data;
  if (!d || d.total === 0) return <ReportEmpty message="No invoices found." />;

  return (
    <div className="flex flex-col gap-3">
      <StatRow
        icon={<FileText className="w-4 h-4" />}
        label="Total Records"
        value={d.total}
      />
      <StatRow
        icon={<FileText className="w-4 h-4" />}
        label="Unique Invoice Nos"
        value={d.uniqueNos}
      />
      <StatRow
        icon={<IndianRupee className="w-4 h-4" />}
        label="Total Invoiced"
        value={formatINR(d.value)}
        highlight
      />
    </div>
  );
}

// ─── POS Receipts Report ──────────────────────────────────────────────────────
// Real endpoint: Services/Reports/POSReceiptsReport/List
// Requires from_date / to_date — defaults to current month.

function getMonthRange() {
  const now   = new Date();
  const yyyy  = now.getFullYear();
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const from  = `${yyyy}-${mm}-01`;
  const last  = new Date(yyyy, now.getMonth() + 1, 0).getDate();
  const to    = `${yyyy}-${mm}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

function POSReceiptsReport({ storeId }) {
  const { from, to } = useMemo(() => getMonthRange(), []);

  const query = useQuery({
    queryKey: QUERY_KEYS.REPORTS.POS_RECEIPTS(storeId, from, to),
    queryFn: async () => {
      const data     = await getPOSReceiptsReport({ company_id: storeId, from_date: from, to_date: to });
      const entities = data?.Entities ?? [];
      const total    = entities.reduce((sum, e) => sum + (Number(e.receipt_amount ?? e.amount) || 0), 0);
      return { count: data?.TotalCount ?? entities.length, total, from, to };
    },
    enabled:   !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  if (!storeId)        return <ReportEmpty message="No store selected." />;
  if (query.isLoading) return <ReportSkeleton />;
  if (query.isError)   return (
    <ReportError message="Receipts report unavailable for this store." onRetry={query.refetch} />
  );

  const d = query.data;
  if (!d || d.count === 0) return <ReportEmpty message="No receipts this month." />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {d.from} — {d.to}
      </p>
      <StatRow
        icon={<Receipt className="w-4 h-4" />}
        label="Receipt Entries"
        value={d.count}
      />
      <StatRow
        icon={<IndianRupee className="w-4 h-4" />}
        label="Total Collected"
        value={formatINR(d.total)}
        highlight
      />
    </div>
  );
}

// ─── Weekly Sales Report ──────────────────────────────────────────────────────
// Real endpoint: Services/POS/SalesFilters/WeeklySales
// No date params — API returns current week server-side.

function WeeklySalesReport({ storeId }) {
  const query = useQuery({
    queryKey: QUERY_KEYS.REPORTS.SALES_WEEKLY(storeId),
    queryFn: async () => {
      const data     = await getWeeklySales({ company_id: storeId });
      const entities = data?.Entities ?? [];
      const total    = entities.reduce(
        (sum, e) => sum + (Number(e.net_amount ?? e.sales_amount ?? e.amount) || 0),
        0
      );
      return { count: data?.TotalCount ?? entities.length, total };
    },
    enabled:   !!storeId,
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  if (!storeId)        return <ReportEmpty message="No store selected." />;
  if (query.isLoading) return <ReportSkeleton />;
  if (query.isError)   return (
    <ReportError message="Weekly sales report unavailable for this store." onRetry={query.refetch} />
  );

  const d = query.data;
  if (!d || d.count === 0) return <ReportEmpty message="No sales this week." />;

  return (
    <div className="flex flex-col gap-3">
      <StatRow
        icon={<TrendingUp className="w-4 h-4" />}
        label="Transactions"
        value={d.count}
      />
      <StatRow
        icon={<IndianRupee className="w-4 h-4" />}
        label="This Week"
        value={formatINR(d.total)}
        highlight
      />
    </div>
  );
}

// ─── Not Available ────────────────────────────────────────────────────────────

function NotAvailableReport({ reason }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      <Ban className="w-7 h-7 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{reason}</p>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function ReportCard({ icon, title, children }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatRow({ icon, label, value, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          highlight ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-5 bg-muted rounded w-full" />
      ))}
    </div>
  );
}

function ReportError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

function ReportEmpty({ message }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-4">{message}</p>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReportsScreen() {
  const storeId = useSelector((state) => state.store.activeStoreId);

  return (
    <div className="p-4 pb-8">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational summaries for this store
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
      </div>

      <div className="flex flex-col gap-4">

        {/* 1 — Orders Summary */}
        <ReportCard
          icon={<ShoppingBag className="w-4 h-4" />}
          title="Orders Summary"
        >
          <OrdersSummaryReport />
        </ReportCard>

        {/* 2 — Invoice Report */}
        <ReportCard
          icon={<FileText className="w-4 h-4" />}
          title="Invoice Report"
        >
          <InvoiceReport storeId={storeId} />
        </ReportCard>

        {/* 3 — POS Receipts (real report endpoint) */}
        <ReportCard
          icon={<Receipt className="w-4 h-4" />}
          title="POS Receipts — This Month"
        >
          <POSReceiptsReport storeId={storeId} />
        </ReportCard>

        {/* 4 — Weekly Sales (real report endpoint) */}
        <ReportCard
          icon={<TrendingUp className="w-4 h-4" />}
          title="Weekly Sales"
        >
          <WeeklySalesReport storeId={storeId} />
        </ReportCard>

        {/* 5 — Scheme Enrollment: known blocker */}
        <ReportCard
          icon={<FileText className="w-4 h-4" />}
          title="Scheme Enrollment Report"
        >
          <NotAvailableReport reason="Scheme enrollment report is unavailable — SchemeEnrollment/List endpoint returning errors on UAT." />
        </ReportCard>

        {/* 6 — Stock Summary: deferred (Take:0 = 0 records on Serenity; large-take fetch not suitable here) */}
        <ReportCard
          icon={<ShoppingBag className="w-4 h-4" />}
          title="Stock Summary"
        >
          <NotAvailableReport reason="Stock summary will be available in a future update." />
        </ReportCard>

      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReportsScreen />
    </Suspense>
  );
}
