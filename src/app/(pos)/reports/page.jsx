'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ArrowLeft, Download, Lock, SlidersHorizontal, X } from 'lucide-react';

import PillTabs from '@/components/shared/PillTabs';
import BottomSheet from '@/components/shared/BottomSheet';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import KPICard from '@/components/features/dashboard/KPICard';
import { selectActiveStoreId, selectActiveStoreName, selectAvailableStores } from '@/store/slices/storeSlice';
import { selectIsSuperAdmin } from '@/store/slices/authSlice';
import { todayDateString, formatDatePadded } from '@/lib/dateUtils';
import { formatAmount, formatAmountOrDash } from '@/lib/priceUtils';
import { downloadXlsx } from '@/lib/excelExport';

import { usePosDashboardReport } from '@/hooks/reports/usePosDashboardReport';
import { useCategoryWiseSalesReport } from '@/hooks/reports/useCategoryWiseSalesReport';
import { useSalesPersonWiseSalesReport } from '@/hooks/reports/useSalesPersonWiseSalesReport';
import { useSkuVelocityReport } from '@/hooks/reports/useSkuVelocityReport';
import { useOpenPosOrdersReport } from '@/hooks/reports/useOpenPosOrdersReport';
import { useStockReport } from '@/hooks/reports/useStockReport';
import { useAdhocReportsList } from '@/hooks/reports/useAdhocReportsList';
import { useAdhocReportRun } from '@/hooks/reports/useAdhocReportRun';

function firstOfMonthDateString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

const BASE_TABS = [
  { key: 'summary',     label: 'Sales Summary' },
  { key: 'category',    label: 'Category Wise' },
  { key: 'salesperson', label: 'Salesperson Wise' },
  { key: 'velocity',    label: 'SKU Velocity' },
  { key: 'openOrders',  label: 'Open Orders' },
  { key: 'stock',       label: 'Stock' },
];
const ADHOC_TAB = { key: 'adhoc', label: 'Ad-hoc Reports' };

// Shared table shell for the four tabular reports — loading/error/empty
// states match this app's existing ListRowsSkeleton/ErrorState/EmptyState
// conventions; the column-driven body is local to this page since no
// generic multi-column DataTable exists elsewhere in the codebase yet.
const PAGE_SIZE = 100;

function formatTotal(column, value) {
  if (column.format) return column.format(value);
  return Number(value.toFixed(3)).toLocaleString('en-IN');
}

function ReportTable({ columns, rows, isLoading, isError, onRetry, emptyMessage, getRowKey }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasMore = visibleCount < rows.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((count) => count + PAGE_SIZE);
    }, { root: scrollRef.current, rootMargin: '400px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  const totals = useMemo(() => {
    if (!columns.some((c) => c.total)) return null;
    return Object.fromEntries(columns.filter((c) => c.total)
      .map((c) => [c.key, rows.reduce((sum, row) => sum + (Number(row[c.key]) || 0), 0)]));
  }, [columns, rows]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
            {columns.map((c) => <Skeleton key={c.key} className="h-4 flex-1" />)}
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState title="Failed to load this report." onRetry={onRetry} />;
  }

  if (!rows.length) {
    return <EmptyState title={emptyMessage ?? 'No records for this range.'} />;
  }

  // A bounded, self-scrolling box (not the whole page). Deliberately NOT the
  // shared Table primitive here — its own wrapper div sets overflow-x-auto,
  // which forces overflow-y to also compute as 'auto' (browsers won't allow
  // one axis visible when the other isn't). Being nearer to the header cells
  // than this div, THAT wrapper — not this one — would win as the sticky
  // positioning anchor, no matter what's set here. Scrolling both axes on
  // this one div directly (never visible/non-visible mixed, so no override)
  // keeps this the only scroll container, and the header sticks correctly.
  return (
    <div className="flex flex-col gap-2">
    <div ref={scrollRef} className="rounded-xl border border-border max-h-[65vh] overflow-auto">
      <table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={`sticky top-0 z-[1] bg-muted/70 backdrop-blur-sm ${c.align === 'right' ? 'text-right' : ''}`}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, visibleCount).map((row, i) => (
            <TableRow key={getRowKey ? getRowKey(row, i) : i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={c.align === 'right' ? 'text-right tabular-nums' : undefined}>
                  {c.format ? c.format(row[c.key], row) : row[c.key] ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {totals && (
          <TableFooter className="sticky bottom-0 z-[1] bg-muted">
            <TableRow>
              {columns.map((c, i) => (
                <TableCell key={c.key} className={`font-semibold ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {c.total ? formatTotal(c, totals[c.key]) : i === 0 ? 'Total' : ''}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </table>
      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}
    </div>
    <p className="text-xs text-muted-foreground">
      Showing {Math.min(visibleCount, rows.length).toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} rows
      {totals && ' · totals cover all rows'}
    </p>
    </div>
  );
}

// OrnaVerse's own DataType strings, confirmed live: 'int', 'number', 'string',
// 'date', 'enum' (paired with EnumTexts). Shared by the on-screen table and
// the export button's enum-decoding, so neither can drift from the other.
function getAdhocColumnConfig(info) {
  const isNumeric = info.DataType === 'int' || info.DataType === 'number';
  const isDate = info.DataType === 'date';
  const isEnum = info.DataType === 'enum' && !!info.EnumTexts;

  return {
    key: info.Name,
    label: info.Title,
    align: isNumeric ? 'right' : undefined,
    format: isEnum
      ? (v) => (v == null ? '—' : info.EnumTexts[String(v)] ?? v)
      : isDate
        ? (v) => (v ? formatDatePadded(v) : '—')
        : isNumeric
          ? (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'))
          : undefined,
  };
}

// Browse + run one of OrnaVerse's 111 user-built ad-hoc reports. Unlike the
// curated tabs, these aren't store/date-scoped — Run is called with an empty
// FilterOverrides, same as OrnaVerse's own default view.
function AdhocReportsTab({ reportsList, selectedReportId, selectedReport, onSelectReport, runReport }) {
  const [search, setSearch] = useState('');

  if (!selectedReportId) {
    const trimmed = search.trim().toLowerCase();
    const filtered = trimmed
      ? reportsList.reports.filter((r) =>
          r.Name.toLowerCase().includes(trimmed) || r.Description?.toLowerCase().includes(trimmed))
      : reportsList.reports;

    if (reportsList.isPermissionError) {
      return (
        <ErrorState
          icon={Lock}
          title="You don't have permission to view ad-hoc reports."
          description="Ask an administrator to grant access to the Reporting module on OrnaVerse."
        />
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <Input
          type="text"
          placeholder="Search reports by name or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search ad-hoc reports"
        />

        {reportsList.isLoading ? (
          <div className="rounded-xl border border-border overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-border last:border-0">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : reportsList.isError ? (
          <ErrorState title="Failed to load ad-hoc reports." onRetry={reportsList.refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching reports." />
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {filtered.map((r) => (
              <button
                key={r.AdhocReportId}
                type="button"
                onClick={() => onSelectReport(r.AdhocReportId)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.Name}</p>
                  {r.Description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.Description}</p>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {r.ChartType}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {reportsList.reports.length} report{reportsList.reports.length !== 1 ? 's' : ''} available
        </p>
      </div>
    );
  }

  const columns = runReport.columns.map(getAdhocColumnConfig);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onSelectReport(null)}
        className="self-end gap-1.5"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to reports
      </Button>

      <div>
        <p className="text-sm font-semibold text-foreground">{selectedReport?.Name}</p>
        {selectedReport?.Description && (
          <p className="text-xs text-muted-foreground mt-0.5">{selectedReport.Description}</p>
        )}
      </div>

      <ReportTable
        columns={columns}
        rows={runReport.rows}
        isLoading={runReport.isLoading}
        isError={runReport.isError}
        onRetry={runReport.refetch}
        getRowKey={(row, i) => i}
        emptyMessage="This report returned no rows."
      />
    </div>
  );
}

// Shared with ReportsPage's export button so the on-screen KPIs and the
// exported CSV can never drift out of sync.
// Labels match OrnaVerse's own POS Dashboard widget verbatim (confirmed live
// 2026-10-19) — total_order_amount/mto_orders/mto_sales are NOT what their
// names suggest; OrnaVerse itself displays them as New MTO/Closed MTO/RTS.
function buildSummaryKpis(data) {
  return [
    { label: 'Total Sales',       value: data.total_sales_amount },
    { label: 'New MTO',           value: data.total_order_amount },
    { label: 'Closed MTO',        value: data.mto_orders },
    { label: 'RTS',               value: data.mto_sales },
    { label: 'RTS / MTO',         value: data.rts_and_mto },
    { label: 'Return/Exchange',   value: data.returns },
    { label: 'Pending MTO',       value: data.pending_mto },
    { label: 'Total URD',         value: data.total_urd },
    { label: 'Schemes',           value: data.scheme },
  ];
}

function SalesSummaryTab({ data, isLoading, isError, onRetry }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => <KPICard key={i} isLoading />)}
      </div>
    );
  }

  if (isError) return <ErrorState title="Failed to load the sales summary." onRetry={onRetry} />;
  if (!data) return <EmptyState title="No summary for this range." />;

  const kpis = buildSummaryKpis(data);
  const collections = (data.total_collections ?? []).filter((c) => c.sales);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <KPICard key={k.label} label={k.label} value={formatAmount(k.value)} />
        ))}
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Payment Collections</p>
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections in this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {collections.map((c) => (
              <div key={c.mode_type} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{c.mode_type}</span>
                <span className="font-medium tabular-nums">{formatAmount(c.sales)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CATEGORY_COLUMNS = [
  { key: 'type_name',       label: 'Category' },
  { key: 'total_pieces',    label: 'Pieces',     align: 'right', total: true },
  { key: 'total_weight',    label: 'Weight (g)', align: 'right', total: true },
  { key: 'total_sub_total', label: 'Subtotal',   align: 'right', format: formatAmountOrDash, total: true },
  { key: 'total_tax_amount', label: 'Tax',        align: 'right', format: formatAmountOrDash, total: true },
  { key: 'total_Net_Amount', label: 'Net Amount', align: 'right', format: formatAmountOrDash, total: true },
];

const SALESPERSON_COLUMNS = [
  { key: 'employee_name', label: 'Sales Person' },
  { key: 'employee_code', label: 'Code' },
  { key: 'pieces',        label: 'Pieces',     align: 'right', total: true },
  { key: 'weight',        label: 'Weight (g)', align: 'right', total: true },
  { key: 'sub_total',     label: 'Subtotal',   align: 'right', format: formatAmountOrDash, total: true },
  { key: 'net_amount',    label: 'Net Amount', align: 'right', format: formatAmountOrDash, total: true },
];

const VELOCITY_COLUMNS = [
  { key: 'ItemCode',           label: 'Item Code' },
  { key: 'ItemGroup',          label: 'Group' },
  { key: 'TotalQuantity',      label: 'Qty Sold',  align: 'right' },
  { key: 'TotalValue',         label: 'Value',     align: 'right', format: formatAmountOrDash },
  { key: 'NormalizedVelocity', label: 'Velocity',  align: 'right', format: (v) => (v == null ? '—' : v.toFixed(2)) },
  { key: 'VelocityRank',       label: 'Rank',      align: 'right' },
  { key: 'Recommendation',     label: 'Recommendation' },
];

const OPEN_ORDERS_COLUMNS = [
  { key: 'document_no',     label: 'Order No.' },
  { key: 'document_date',   label: 'Date',      format: formatDatePadded },
  { key: 'party_name',      label: 'Customer' },
  { key: 'net_amount',      label: 'Net Amount', align: 'right', format: formatAmountOrDash },
  { key: 'receipt_amount',  label: 'Received',   align: 'right', format: formatAmountOrDash },
  { key: 'balance_amount',  label: 'Balance',    align: 'right', format: formatAmountOrDash },
];

const STORE_COLUMNS = [
  { key: 'store_code', label: 'Store Code' },
  { key: 'store_name', label: 'Store Name' },
];

const STOCK_COLUMNS = [
  { key: 'item_code',          label: 'Item Code' },
  { key: 'item_name',          label: 'Item Name' },
  { key: 'sku',                label: 'SKU' },
  { key: 'location_name',      label: 'Location' },
  { key: 'item_group_name',    label: 'Item Group' },
  { key: 'type_name',          label: 'Type' },
  { key: 'sub_type_name',      label: 'Sub Type' },
  { key: 'karat_name',         label: 'Karat' },
  { key: 'metal_color_name',   label: 'Metal Color' },
  { key: 'item_size_name',     label: 'Size' },
  { key: 'huid',               label: 'HUID' },
  { key: 'certificate_no',     label: 'Certificate No.' },
  { key: 'hsn',                label: 'HSN' },
  { key: 'supplier_style',     label: 'Supplier Style' },
  { key: 'supplier_batch',     label: 'Supplier Batch' },
  { key: 'pieces',             label: 'Pieces',       align: 'right', total: true },
  { key: 'weight',             label: 'Gross Wt (g)', align: 'right', total: true },
  { key: 'net_weight',         label: 'Net Wt (g)',   align: 'right', total: true },
  { key: 'diamond_pieces',     label: 'Dia Pcs',      align: 'right', total: true },
  { key: 'diamond_weight',     label: 'Dia Wt (ct)',  align: 'right', total: true },
  { key: 'color_stone_pieces', label: 'CS Pcs',       align: 'right', total: true },
  { key: 'color_stone_weight', label: 'CS Wt',        align: 'right', total: true },
  { key: 'stone_pieces',       label: 'Stone Pcs',    align: 'right', total: true },
  { key: 'stone_weight',       label: 'Stone Wt',     align: 'right', total: true },
  { key: 'other_pieces',       label: 'Other Pcs',    align: 'right', total: true },
  { key: 'other_weight',       label: 'Other Wt',     align: 'right', total: true },
  { key: 'center_stone_shape_name',   label: 'Center Stone Shape' },
  { key: 'center_stone_weight_name',  label: 'Center Stone Wt' },
  { key: 'center_stone_color_name',   label: 'Center Stone Color' },
  { key: 'center_stone_quality_name', label: 'Center Stone Quality' },
  { key: 'is_allocated',       label: 'Allocated',    format: (v) => (v ? 'Yes' : 'No') },
];

const normalizeName = (name) => String(name ?? '').trim().toLowerCase();

// Rows identify their store differently per endpoint (company_id, company_code,
// or only the store's name). Rows outside the selected stores are dropped —
// SKU Velocity ignores company_ids upstream and returns every store.
function scopeRowsToStores(rows, stores, selectedIds) {
  const byId   = new Map(stores.map((s) => [s.company_id, s]));
  const byCode = new Map(stores.map((s) => [s.company_code, s]));
  const byName = new Map(stores.map((s) => [normalizeName(s.mailing_name), s]));
  const selected = new Set(selectedIds);
  return rows.flatMap((row) => {
    const store = byId.get(row.company_id)
      ?? byCode.get(row.company_code)
      ?? byName.get(normalizeName(row.Company ?? row.mailing_name));
    if (!store || !selected.has(store.company_id)) return [];
    return [{ ...row, store_code: store.company_code, store_name: store.mailing_name }];
  });
}

export default function ReportsPage() {
  const companyId   = useSelector(selectActiveStoreId);
  const companyName = useSelector(selectActiveStoreName);
  const availableStores = useSelector(selectAvailableStores);
  const isSuperAdmin = useSelector(selectIsSuperAdmin);

  const [activeTab, setActiveTab] = useState('summary');
  // Super admin only: null = the active store, 'all', or a company_id string. Store logins are always pinned to their active store.
  const [storeFilter, setStoreFilter] = useState(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [fromDate, setFromDate] = useState(() => firstOfMonthDateString());
  const [toDate, setToDate]     = useState(() => todayDateString());
  const hasCustomRange = fromDate !== firstOfMonthDateString() || toDate !== todayDateString();

  const handleResetRange = () => {
    setFromDate(firstOfMonthDateString());
    setToDate(todayDateString());
  };

  const handleToday = () => {
    setFromDate(todayDateString());
    setToDate(todayDateString());
  };

  const isAllStores = isSuperAdmin && storeFilter === 'all';
  const selectedCompanyIds = !companyId
    ? []
    : isAllStores
      ? availableStores.map((s) => s.company_id)
      : [isSuperAdmin && storeFilter ? Number(storeFilter) : companyId];
  const selectedStoreName = isAllStores
    ? `all ${availableStores.length} stores`
    : availableStores.find((s) => s.company_id === selectedCompanyIds[0])?.mailing_name ?? companyName;

  const range = { companyIds: selectedCompanyIds, fromDate, toDate };

  // Only the open tab's report is fetched — firing all of them at once adds needless load on OrnaVerse.
  const summaryReport     = usePosDashboardReport({ ...range, enabled: activeTab === 'summary' });
  const categoryReport    = useCategoryWiseSalesReport({ ...range, enabled: activeTab === 'category' });
  const salesPersonReport = useSalesPersonWiseSalesReport({ ...range, enabled: activeTab === 'salesperson' });
  const velocityReport    = useSkuVelocityReport({ ...range, enabled: activeTab === 'velocity' });
  const openOrdersReport  = useOpenPosOrdersReport({ ...range, enabled: activeTab === 'openOrders' });
  const stockReport       = useStockReport({ companyIds: selectedCompanyIds, toDate, enabled: activeTab === 'stock' });

const tableKey = `${activeTab}-${selectedCompanyIds.join(',')}-${fromDate}-${toDate}`;
  const scope = (rows) => scopeRowsToStores(rows, availableStores, selectedCompanyIds);
  const withStoreColumns = (columns) => (isAllStores ? [...STORE_COLUMNS, ...columns] : columns);

  const [selectedAdhocReportId, setSelectedAdhocReportId] = useState(null);
  const adhocReportsList = useAdhocReportsList();
  const adhocReportRun   = useAdhocReportRun(selectedAdhocReportId);
  const selectedAdhocReport = adhocReportsList.reports.find((r) => r.AdhocReportId === selectedAdhocReportId) ?? null;
  // Hide the tab rather than let a restricted user click into a dead end —
  // confirmed live 2026-10-16: OrnaVerse's own AdhocReport/List 400s with
  // Error.Code "AccessDenied" for an account with no Reporting:AdhocReports:
  // View permission, surfaced here via isPermissionError.
  const TABS = adhocReportsList.isPermissionError ? BASE_TABS : [...BASE_TABS, ADHOC_TAB];

  const TAB_REPORTS = {
    category:    { columns: withStoreColumns(CATEGORY_COLUMNS),    rows: scope(categoryReport.rows),    filenamePrefix: 'category-wise-sales' },
    salesperson: { columns: withStoreColumns(SALESPERSON_COLUMNS), rows: scope(salesPersonReport.rows), filenamePrefix: 'salesperson-wise-sales' },
    velocity:    { columns: withStoreColumns(VELOCITY_COLUMNS),    rows: scope(velocityReport.rows),    filenamePrefix: 'sku-velocity' },
    openOrders:  { columns: withStoreColumns(OPEN_ORDERS_COLUMNS), rows: scope(openOrdersReport.rows),  filenamePrefix: 'open-pos-orders' },
    stock:       { columns: [...STORE_COLUMNS, ...STOCK_COLUMNS],  rows: scope(stockReport.rows),       filenamePrefix: 'jewellery-stock' },
  };

  const canExport = activeTab === 'summary'
    ? !!summaryReport.data
    : activeTab === 'adhoc'
      ? adhocReportRun.rows.length > 0
      : (TAB_REPORTS[activeTab]?.rows.length ?? 0) > 0;

  const handleExport = () => {
    if (activeTab === 'summary') {
      if (!summaryReport.data) return;
      downloadXlsx(`sales-summary_${fromDate}_to_${toDate}.xlsx`, [
        {
          name: 'Summary',
          columns: [{ key: 'label', label: 'Metric' }, { key: 'value', label: 'Value' }],
          rows: buildSummaryKpis(summaryReport.data),
        },
        {
          name: 'Payment Collections',
          columns: [{ key: 'mode_type', label: 'Payment Mode' }, { key: 'sales', label: 'Amount' }],
          rows: (summaryReport.data.total_collections ?? []).filter((c) => c.sales),
        },
      ]);
      return;
    }
    if (activeTab === 'adhoc') {
      if (!selectedAdhocReport || adhocReportRun.rows.length === 0) return;
      const exportColumns = adhocReportRun.columns.map((info) => ({ key: info.Name, label: info.Title }));
      const exportRows = adhocReportRun.rows.map((row) => {
        const out = {};
        adhocReportRun.columns.forEach((info) => {
          const raw = row[info.Name];
          out[info.Name] = (info.DataType === 'enum' && info.EnumTexts) ? (info.EnumTexts[String(raw)] ?? raw) : raw;
        });
        return out;
      });
      const safeName = selectedAdhocReport.Name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadXlsx(`${safeName}.xlsx`, [{ name: selectedAdhocReport.Name, columns: exportColumns, rows: exportRows }]);
      return;
    }
    const { columns, rows, filenamePrefix } = TAB_REPORTS[activeTab];
    const filename = activeTab === 'stock'
      ? `${filenamePrefix}_as_of_${toDate}.xlsx`
      : `${filenamePrefix}_${fromDate}_to_${toDate}.xlsx`;
    downloadXlsx(filename, [{ name: 'Report', columns, rows }]);
  };

  const activeTabLabel = TABS.find((t) => t.key === activeTab)?.label ?? 'Report';
  const rangeSummary = activeTab === 'adhoc'
    ? 'All stores and dates'
    : activeTab === 'stock'
      ? `As of ${formatDatePadded(toDate)}`
      : `${formatDatePadded(fromDate)} – ${formatDatePadded(toDate)}`;

  const dateInputs = activeTab === 'adhoc' ? (
    <p className="text-xs text-muted-foreground">
      Ad-hoc reports query live across all stores and dates — not scoped to a range.
    </p>
  ) : (
    <div className="flex items-center gap-2 w-full md:w-auto">
      {activeTab === 'stock' ? (
        <span className="text-muted-foreground text-sm shrink-0">Stock as of</span>
      ) : (
        <>
          <Input
            type="date"
            value={fromDate}
            max={todayDateString()}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="h-11 flex-1 md:h-9 md:w-37.5 md:flex-none"
          />
          <span className="text-muted-foreground text-sm shrink-0">to</span>
        </>
      )}
      <Input
        type="date"
        value={toDate}
        max={todayDateString()}
        onChange={(e) => setToDate(e.target.value)}
        aria-label="To date"
        className="h-11 flex-1 md:h-9 md:w-37.5 md:flex-none"
      />
    </div>
  );

  const storeSelect = isSuperAdmin && activeTab !== 'adhoc' && (
    <Select value={storeFilter ?? String(companyId)} onValueChange={setStoreFilter}>
      <SelectTrigger className="h-11 w-full md:h-9 md:w-56" aria-label="Store">
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All stores</SelectItem>
        {availableStores.map((store) => (
          <SelectItem key={store.company_id} value={String(store.company_id)}>
            {store.company_code} — {store.mailing_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const rangeButtons = activeTab !== 'adhoc' && (
    <>
      <Button type="button" variant="outline" size="sm" onClick={handleToday} className="flex-1 md:flex-none">
        Today
      </Button>
      {hasCustomRange && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetRange}
          className="flex-1 gap-1.5 md:flex-none"
          aria-label="Reset date range"
        >
          <X size={14} aria-hidden="true" />
          Reset
        </Button>
      )}
    </>
  );

  const exportButton = (className) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!canExport}
      className={`gap-1.5 ${className}`}
    >
      <Download size={14} aria-hidden="true" />
      Export Excel
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 w-full p-4 pb-28 md:p-6 md:pb-6">
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pt-4 pb-3 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <p className="text-sm text-muted-foreground">
          {selectedStoreName ? `For ${selectedStoreName}` : 'For the active store'}
        </p>

        {companyId && (
          <>
            <div className="md:hidden flex flex-col gap-2">
              <p className="text-sm">
                <span className="font-semibold text-foreground">{activeTabLabel}</span>
                <span className="text-muted-foreground"> · {rangeSummary}</span>
              </p>
              {exportButton('h-10 w-full')}
            </div>

            <div className="hidden md:flex flex-wrap items-center gap-2">
              {dateInputs}
              <div className="flex items-center gap-2 ml-auto">
                {storeSelect}
                {rangeButtons}
                {exportButton('')}
              </div>
            </div>

            <div className="hidden md:block">
              <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} scrollable variant="chip" />
            </div>
          </>
        )}
      </div>

      {companyId && (
        <div className="md:hidden fixed inset-x-0 bottom-4 z-30 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-background shadow-xl active:bg-primary/90"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            {activeTabLabel} · Filters
          </button>
        </div>
      )}

      <BottomSheet
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Report & Filters"
        footerClassName="p-0"
        footer={
          <Button type="button" className="min-h-14 w-full rounded-none" onClick={() => setIsMobileFilterOpen(false)}>
            Show Report
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Report</span>
            <div className="grid grid-cols-2 gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  aria-pressed={activeTab === tab.key}
                  className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {activeTab === 'stock' ? 'Date' : 'Date range'}
            </span>
            {dateInputs}
            {rangeButtons && <div className="flex gap-2">{rangeButtons}</div>}
          </div>

          {storeSelect && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Store</span>
              {storeSelect}
            </div>
          )}
        </div>
      </BottomSheet>

      {!companyId ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No store selected. Please switch to a store to view reports.</p>
        </div>
      ) : (
        <>
          {activeTab === 'summary' && (
            <SalesSummaryTab
              data={summaryReport.data}
              isLoading={summaryReport.isLoading}
              isError={summaryReport.isError}
              onRetry={summaryReport.refetch}
            />
          )}

          {activeTab === 'category' && (
            <ReportTable
              key={tableKey}
              columns={TAB_REPORTS.category.columns}
              rows={TAB_REPORTS.category.rows}
              isLoading={categoryReport.isLoading}
              isError={categoryReport.isError}
              onRetry={categoryReport.refetch}
              getRowKey={(row) => `${row.company_id}-${row.type_name}`}
              emptyMessage="No category sales in this range."
            />
          )}

          {activeTab === 'salesperson' && (
            <ReportTable
              key={tableKey}
              columns={TAB_REPORTS.salesperson.columns}
              rows={TAB_REPORTS.salesperson.rows}
              isLoading={salesPersonReport.isLoading}
              isError={salesPersonReport.isError}
              onRetry={salesPersonReport.refetch}
              getRowKey={(row, i) => row.transaction_item_id ?? i}
              emptyMessage="No salesperson sales in this range."
            />
          )}

          {activeTab === 'velocity' && (
            <ReportTable
              key={tableKey}
              columns={TAB_REPORTS.velocity.columns}
              rows={TAB_REPORTS.velocity.rows}
              isLoading={velocityReport.isLoading}
              isError={velocityReport.isError}
              onRetry={velocityReport.refetch}
              getRowKey={(row) => row.performance_id}
              emptyMessage="No SKU velocity data in this range."
            />
          )}

          {activeTab === 'openOrders' && (
            <ReportTable
              key={tableKey}
              columns={TAB_REPORTS.openOrders.columns}
              rows={TAB_REPORTS.openOrders.rows}
              isLoading={openOrdersReport.isLoading}
              isError={openOrdersReport.isError}
              onRetry={openOrdersReport.refetch}
              getRowKey={(row, i) => i} // one Entity per order LINE, not per order — document_no repeats
              emptyMessage="No open orders in this range."
            />
          )}

          {activeTab === 'stock' && (
            <ReportTable
              key={tableKey}
              columns={TAB_REPORTS.stock.columns}
              rows={TAB_REPORTS.stock.rows}
              isLoading={stockReport.isLoading}
              isError={stockReport.isError}
              onRetry={stockReport.refetch}
              getRowKey={(row, i) => i} // SKUs repeat (bulk stock rows)
              emptyMessage="No stock for this store on this date."
            />
          )}

          {activeTab === 'adhoc' && (
            <AdhocReportsTab
              reportsList={adhocReportsList}
              selectedReportId={selectedAdhocReportId}
              selectedReport={selectedAdhocReport}
              onSelectReport={setSelectedAdhocReportId}
              runReport={adhocReportRun}
            />
          )}
        </>
      )}
    </div>
  );
}
