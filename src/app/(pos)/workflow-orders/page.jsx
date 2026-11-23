// src/app/(pos)/workflow-orders/page.jsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  Workflow,
  Search,
  X,
  RefreshCw,
  Filter,
  Eye,
  Calendar,
  Layers,
  Factory,
  ShieldCheck,
  Truck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { WORKFLOW_STAGES, getStageMeta } from '@/lib/workflow/workflowConstants';
import { useWorkflowOrders } from '@/hooks/workflow/useWorkflowOrders';
import WorkflowStageBadge from '@/components/features/workflow/WorkflowStageBadge';
import WorkflowStatusBadge from '@/components/features/workflow/WorkflowStatusBadge';
import WorkflowOrderDetailSheet from '@/components/features/workflow/WorkflowOrderDetailSheet';
import PhoneLink from '@/components/shared/PhoneLink';
import { formatDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export default function WorkflowOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStep, setSelectedStep] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const queryParams = useMemo(
    () => ({
      search: searchTerm,
      step: selectedStep,
      status: selectedStatus,
      page,
      pageSize,
    }),
    [searchTerm, selectedStep, selectedStatus, page, pageSize]
  );

  const { orders, total, totalPages, isLoading, isFetching, refetch } = useWorkflowOrders(queryParams);

  const handleCopy = (e, text, id) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRowClick = (order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setPage(1);
  };

  // Quick Stats
  const stats = useMemo(() => {
    const list = orders || [];
    return {
      totalOrders: total || list.length,
      inVendorOps: list.filter((o) => o.current_step === 'vendor_ops' || o.current_step === 'vendor_assignment').length,
      inQC: list.filter((o) => o.current_step === 'inward_qc' || o.current_step === 'certificate_team').length,
      inShipping: list.filter((o) => o.current_step === 'shipping' || o.current_step === 'packaging').length,
    };
  }, [orders, total]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  return (
    <div className="p-4 md:p-6 pb-12 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Workflow size={22} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold font-heading text-foreground tracking-tight">
                Workflow Orders
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Live 11-stage manufacturing & fulfillment lifecycle tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Tickets</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : stats.totalOrders}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Layers size={18} />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In Production</p>
            <p className="text-2xl font-bold font-heading text-blue-600 dark:text-blue-400 mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : stats.inVendorOps}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Factory size={18} />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">QC & Cert</p>
            <p className="text-2xl font-bold font-heading text-orange-600 dark:text-orange-400 mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : stats.inQC}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Shipping / Transit</p>
            <p className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
              {isLoading ? <Skeleton className="h-7 w-12" /> : stats.inShipping}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Truck size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Unified Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Unified Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Unified search by Order #, PO #, ERP Doc #, Customer, SKU..."
            className="pl-9 pr-9 h-10 text-xs sm:text-sm bg-card"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Status Dropdown */}
        <div className="w-full sm:w-[180px]">
          <Select
            value={selectedStatus}
            onValueChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 text-xs bg-card">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_production">In Production</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 11 Stage Tabs / Quick Filter Carousel */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => {
            setSelectedStep('all');
            setPage(1);
          }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
            selectedStep === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted'
          )}
        >
          All Stages
        </button>

        {WORKFLOW_STAGES.map((stage) => {
          const isActive = selectedStep === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => {
                setSelectedStep(stage.key);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted'
              )}
            >
              <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[10px] font-bold">
                {stage.stepNumber}
              </span>
              <span>{stage.label}</span>
            </button>
          );
        })}
      </div>

      {/* Orders Table */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Order / Identifier</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items / SKU</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Lifecycle Stage</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton className="h-7 w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : orders && orders.length > 0 ? (
                orders.map((order) => {
                  const stageMeta = getStageMeta(order.current_step);
                  const stepNumber = stageMeta?.stepNumber || 1;

                  return (
                    <tr
                      key={order.id || order.order_number}
                      onClick={() => handleRowClick(order)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      {/* Order / Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold font-mono text-foreground text-sm group-hover:text-primary transition-colors">
                              {order.order_number}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, order.order_number, `ord-${order.id}`)}
                              className="text-muted-foreground hover:text-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Copy Order #"
                            >
                              {copiedId === `ord-${order.id}` ? (
                                <Check size={12} className="text-emerald-600" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>

                          {order.erp_document_no && (
                            <span className="text-[11px] font-mono text-muted-foreground">
                              ERP: {order.erp_document_no}
                            </span>
                          )}
                          {order.po_number && (
                            <span className="text-[10px] font-mono text-muted-foreground/80">
                              PO: {order.po_number}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5 max-w-[180px]">
                          <span className="font-medium text-foreground truncate">
                            {order.customer?.name || 'Walk-in Customer'}
                          </span>
                          {order.customer?.phone && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <PhoneLink phone={order.customer.phone} name={order.customer.name} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5 max-w-[220px]">
                          {order.items && order.items.length > 0 ? (
                            <>
                              <span className="font-medium text-foreground truncate">
                                {order.items[0].title}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                SKU: {order.items[0].sku} (Qty: {order.items[0].quantity})
                              </span>
                              {order.items.length > 1 && (
                                <span className="text-[10px] text-primary font-semibold">
                                  +{order.items.length - 1} more item(s)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">No items</span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-semibold font-mono text-foreground">
                        {formatCurrency(order.financials?.total || order.total_amount)}
                      </td>

                      {/* Lifecycle Stage with 11-step progress dots */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          <WorkflowStageBadge stageKey={order.current_step} />
                          {/* Mini 11-step progression dots */}
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 11 }).map((_, dotIdx) => {
                              const dotStep = dotIdx + 1;
                              const isFilled = dotStep <= stepNumber;
                              const isCurrent = dotStep === stepNumber;

                              return (
                                <span
                                  key={dotIdx}
                                  className={cn(
                                    'w-1.5 h-1.5 rounded-full transition-all',
                                    isCurrent
                                      ? 'bg-primary ring-1 ring-primary/40 scale-125'
                                      : isFilled
                                      ? 'bg-emerald-500'
                                      : 'bg-muted-foreground/30'
                                  )}
                                  title={`Stage ${dotStep} of 11`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <WorkflowStatusBadge status={order.status} />
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">
                        {order.created_at ? formatDateTime(order.created_at) : 'N/A'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(order);
                          }}
                          className="h-8 gap-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Eye size={14} /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="p-3 bg-muted rounded-full text-muted-foreground">
                        <Workflow size={24} />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">No Workflow Orders Found</h3>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm
                          ? `No orders matching "${searchTerm}". Try searching by order number, PO, or ERP document number.`
                          : 'No workflow orders currently match the selected filters.'}
                      </p>
                      {searchTerm && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="sm" onClick={clearSearch} className="h-8 text-xs">
                            Clear Search Filter
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSearchTerm('MAL-26-0001')}
                            className="h-8 text-xs font-mono"
                          >
                            Try MAL-26-0001
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Showing {orders.length} of {total} orders
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft size={14} /> Previous
              </Button>

              <span className="font-medium text-foreground px-2">
                Page {page} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 gap-1 text-xs"
              >
                Next <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Order Detail Sheet */}
      <WorkflowOrderDetailSheet
        order={selectedOrder}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
      />
    </div>
  );
}
