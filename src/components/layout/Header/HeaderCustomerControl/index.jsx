'use client';

// src/components/layout/Header/HeaderCustomerControl/index.jsx
// Header-level "Customer" control — shows attached customer or
// "Add Customer" prompt, opens CustomerSessionSheet.
// Available on every POS screen, independent of cart/checkout.

import { useState } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSessionSheet from '@/components/features/customers/CustomerSessionSheet';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { cn } from '@/lib/utils';

export default function HeaderCustomerControl() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isAttached, customerName } = useCustomerSession();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setSheetOpen(true)}
        className={cn(
          'flex items-center gap-2 min-h-[44px] px-3',
          isAttached && 'text-primary'
        )}
        aria-label={isAttached ? `Customer: ${customerName}` : 'Add customer'}
      >
        <User size={18} aria-hidden="true" />
        <span className="hidden md:inline text-sm font-medium max-w-[140px] truncate">
          {isAttached ? customerName : 'Add Customer'}
        </span>
        <ChevronDown size={14} aria-hidden="true" className="hidden md:inline" />
      </Button>

      <CustomerSessionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}