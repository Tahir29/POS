// src/app/(pos)/reports/page.jsx
'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingBag,
  FileText,
  BarChart2,
  BookOpen,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { useAllOrders } from '@/hooks/orders/useAllOrders';
import { getInvoiceList } from '@/services/orderService';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import PageLoader from '@/components/shared/PageLoader';

// ─── Orders Summary ───────────────────────────────────────────────────────────

function OrdersSummaryReport() {
  const { allOrders, isLoading, isError, refetch } = useAllOrders();

  const stats = useMemo(() => {
    if (!allOrders.length) return null;
    const total      = allOrders.length;
    const paid       = allOrders.filter((o) => o.status === 'paid').length;
    const partial    = allOrders.filter((o) => o.status === 'partial').length;
    const due        = allOrders.filter((o) => o.status === 'due').length;
    const totalValue = allOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0
    );
    return { total, paid, partial, due, totalValue };
  }, [allOrders]);

  if (isLoading) return <ReportSkeleton />;
  if (isError)   return <ReportError message="Failed to load orders summary." onRetry={refetch} />;
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
        value={`₹${stats.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
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

function InvoiceReport() {
  const query = useQuery({
    queryKey: QUERY_KEYS.ORDERS.INVOICE_LIST({ skip: 0, take: 0 }),
    queryFn: async () => {
      const response = await getInvoiceList({ take: 0, skip: 0 });
      const entities = response?.Entities ?? [];
      return {
        totalCount:     response?.TotalCount ?? entities.length,
        totalValue:     entities.reduce(
          (sum, e) => sum + (Number(e.gross_amount ?? e.net_amount) || 0),
          0
        ),
        uniqueInvoices: new Set(
          entities.map((e) => e.document_no).filter(Boolean)
        ).size,
      };
    },
    staleTime: APP_CONFIG.STALE_TIME.ORDERS,
  });

  if (query.isLoading) return <ReportSkeleton />;
  if (query.isError)   return <ReportError message="Failed to load invoice report." onRetry={query.refetch} />;

  const data = query.data;
  if (!data || data.totalCount === 0) return <ReportEmpty message="No invoices found." />;

  return (
    <div className="flex flex-col gap-3">
      <StatRow
        icon={<FileText className="w-4 h-4" />}
        label="Total Line Items"
        value={data.totalCount}
      />
      <StatRow
        icon={<FileText className="w-4 h-4" />}
        label="Unique Invoices"
        value={data.uniqueInvoices}
      />
      <StatRow
        icon={<IndianRupee className="w-4 h-4" />}
        label="Total Invoiced Value"
        value={`₹${data.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        highlight
      />
    </div>
  );
}

// ─── Not Available placeholder ────────────────────────────────────────────────

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
      <span className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
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
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-medium text-primary"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
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
  return (
    <div className="p-4 pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Operational summaries for this store
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <ReportCard icon={<ShoppingBag className="w-4 h-4" />} title="Orders Summary">
          <OrdersSummaryReport />
        </ReportCard>

        <ReportCard icon={<FileText className="w-4 h-4" />} title="Invoice Report">
          <InvoiceReport />
        </ReportCard>

        <ReportCard icon={<BarChart2 className="w-4 h-4" />} title="Stock Summary">
          <NotAvailableReport reason="Stock summary report is not available in the current API." />
        </ReportCard>

        <ReportCard icon={<BookOpen className="w-4 h-4" />} title="Scheme Enrollment Report">
          <NotAvailableReport reason="Scheme enrollment report is not available — service endpoint returning errors." />
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