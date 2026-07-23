'use client';

// src/components/features/invoices/InvoiceListItem/index.jsx
// A single card in the invoice list. Tappable to open details.
// Invoice number sourced from invoice.raw.document_no (confirmed from
// InvoiceDetailSheet). Design mirrors OrderListItem card layout.

import { User, Calendar, Store, Phone, Mail } from 'lucide-react';
import ListItemCard from '@/components/shared/ListItemCard';

/**
 * @param {{
 *   invoice: {
 *     customerName, customerEmail, customerMobile,
 *     itemName, totalAmount,
 *     raw: { document_no, document_date, location_name, company_name }
 *   },
 *   onSelect: () => void,
 * }} props
 */
export default function InvoiceListItem({ invoice, onSelect }) {
  const {
    customerName,
    customerEmail,
    customerMobile,
    totalAmount,
    raw,
  } = invoice;

  const invoiceNo   = raw?.document_no;
  const invoiceDate = raw?.document_date;
  const storeName   = raw?.location_name ?? raw?.company_name;

  return (
    <ListItemCard
      onSelect={onSelect}
      header={invoiceNo || 'Invoice'}
      footer={totalAmount != null && (
        <p className="text-[18px] font-bold text-foreground">
          &#8377;{Number(totalAmount).toLocaleString('en-IN')}
        </p>
      )}
    >
      {/* Row 1: Customer + Date */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
          <User size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerName || '—'}</span>
        </span>
        {invoiceDate && (
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground shrink-0">
            <Calendar size={13} className="text-muted-foreground/70" aria-hidden="true" />
            {new Date(invoiceDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Row 2: Store */}
      {storeName && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Store size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{storeName}</span>
        </div>
      )}

      {/* Row 3: Mobile */}
      {customerMobile && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Phone size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerMobile}</span>
        </div>
      )}

      {/* Row 4: Email */}
      {customerEmail && (
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Mail size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <span className="truncate">{customerEmail}</span>
        </div>
      )}
    </ListItemCard>
  );
}
