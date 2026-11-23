// src/components/features/workflow/WorkflowOrderDetailSheet.jsx
'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Copy,
  Check,
  Package,
  User,
  MapPin,
  CreditCard,
  FileText,
  Clock,
  Layers,
  Sparkles,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import WorkflowStageBadge from './WorkflowStageBadge';
import WorkflowStatusBadge from './WorkflowStatusBadge';
import WorkflowLifecycleStepper from './WorkflowLifecycleStepper';
import PhoneLink from '@/components/shared/PhoneLink';
import { formatDateTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

export default function WorkflowOrderDetailSheet({ order, open, onOpenChange }) {
  const [copiedKey, setCopiedKey] = useState(null);

  if (!order) return null;

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <SheetHeader className="space-y-2 text-left pb-2 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WorkflowStatusBadge status={order.status} />
              <WorkflowStageBadge stageKey={order.current_step} />
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              ID: #{order.id || order.order_id}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-2xl font-bold font-heading text-foreground tracking-tight">
                {order.order_number}
              </SheetTitle>
              <button
                type="button"
                onClick={() => handleCopy(order.order_number, 'order_num')}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy Order Number"
              >
                {copiedKey === 'order_num' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              </button>
            </div>
            {order.channel && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                {order.channel} · {order.source_name || 'store'}
              </span>
            )}
          </div>

          <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Created: {order.created_at ? formatDateTime(order.created_at) : 'N/A'}</span>
            {order.updated_at && <span>Updated: {formatDateTime(order.updated_at)}</span>}
            {order.priority && (
              <span className="font-semibold uppercase text-[11px] text-primary">
                Priority: {order.priority}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Quick Identifiers Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/40 rounded-xl border border-border">
          <div className="flex items-center justify-between p-2 bg-background rounded-lg border border-border/60">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">PO Number</span>
              <span className="text-xs font-semibold font-mono text-foreground truncate max-w-[180px]">
                {order.po_number || 'Not Generated'}
              </span>
            </div>
            {order.po_number && (
              <button
                type="button"
                onClick={() => handleCopy(order.po_number, 'po')}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Copy PO Number"
              >
                {copiedKey === 'po' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-2 bg-background rounded-lg border border-border/60">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">ERP Document No</span>
              <span className="text-xs font-semibold font-mono text-foreground truncate max-w-[180px]">
                {order.erp_document_no || 'Pending Push'}
              </span>
            </div>
            {order.erp_document_no && (
              <button
                type="button"
                onClick={() => handleCopy(order.erp_document_no, 'erp')}
                className="p-1 text-muted-foreground hover:text-foreground"
                title="Copy ERP Document Number"
              >
                {copiedKey === 'erp' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            )}
          </div>
        </div>

        {/* 11-Stage Lifecycle Stepper Component */}
        <WorkflowLifecycleStepper order={order} initialExpanded={true} />

        {/* Ordered Items */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Ordered Items ({order.items?.length || 0})</h3>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="p-3.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        SKU: <strong className="text-foreground">{item.sku}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(item.price)}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>

                  {item.properties && item.properties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.properties.map((prop, pIdx) => (
                        <span
                          key={pIdx}
                          className="px-2 py-0.5 rounded bg-muted text-[11px] font-medium text-muted-foreground"
                        >
                          {prop.name}: <strong className="text-foreground">{prop.value}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-xs text-muted-foreground italic">No items listed</div>
            )}
          </div>
        </div>

        {/* Customer & Shipping Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <User size={15} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</h4>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground text-sm">{order.customer?.name || 'Walk-in / Unnamed'}</p>
              {order.customer?.phone && (
                <div className="pt-1">
                  <PhoneLink phone={order.customer.phone} name={order.customer.name} />
                </div>
              )}
              {order.customer?.email && (
                <p className="text-muted-foreground truncate">{order.customer.email}</p>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <MapPin size={15} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipping Address</h4>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {order.shipping_address ? (
                <>
                  <p className="text-foreground font-medium">{order.shipping_address.address1}</p>
                  <p>
                    {[
                      order.shipping_address.city,
                      order.shipping_address.province,
                      order.shipping_address.zip,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <p>{order.shipping_address.country || 'India'}</p>
                </>
              ) : (
                <p className="italic">Store pickup / No shipping address</p>
              )}
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financials</h4>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
              {order.payment_mode || 'Prepaid'}
            </span>
          </div>

          <div className="text-xs space-y-1.5 pt-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium text-foreground">{formatCurrency(order.financials?.subtotal || order.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (GST):</span>
              <span className="font-medium text-foreground">{formatCurrency(order.financials?.tax || 0)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/60">
              <span>Total Payable:</span>
              <span className="text-primary">{formatCurrency(order.financials?.total || order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* ERP Sync Status */}
        {order.erp_sync && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ERP Sync Details</h4>
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded border',
                  order.erp_sync.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                )}
              >
                {order.erp_sync.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Document No</span>
                <p className="font-mono font-medium text-foreground">{order.erp_sync.documentNo || 'N/A'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Synced Timestamp</span>
                <p className="text-muted-foreground">
                  {order.erp_sync.syncedAt ? formatDateTime(order.erp_sync.syncedAt) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline / Audit Trail Logs */}
        {order.timeline_logs && order.timeline_logs.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Timeline & Audit Trail</h3>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {order.timeline_logs.map((log, idx) => (
                <div key={idx} className="relative flex flex-col gap-0.5 text-xs">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground capitalize">
                      {log.action?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {log.timestamp ? formatDateTime(log.timestamp) : ''}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">By: {log.user || 'System'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
