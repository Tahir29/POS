'use client';

// src/components/features/checkout/PrintInvoiceButton/index.jsx
// Triggers browser print of the invoice. Assumes the invoice content is
// rendered in a printable area (id="invoice-print-area") on the page —
// CSS in globals.css should hide non-invoice content via @media print.
//
// NOTE: No dedicated POS receipt-printer integration exists yet — this
// uses the browser print dialog as the MVP path (per DEVELOPMENT_PHASES.md,
// receipt printer hardware integration is out of scope for Phase 9b).

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrintInvoiceButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      className="h-12 w-full gap-2"
    >
      <Printer size={18} aria-hidden="true" />
      Print Invoice
    </Button>
  );
}