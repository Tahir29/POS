'use client';

// src/components/features/checkout/SalesPersonSelect/index.jsx
// "Sales Person" picker for checkout — mirrors the same field on the
// vendor's own POS Sale screen (confirmed 2026-07-16: they select an
// employee name before placing the order). Reuses useSalesPersonOptions,
// the same store-scoped Employee/List picker already used and confirmed
// working on Scheme Enrollment — not duplicated here.

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSalesPersonOptions } from '@/hooks/schemes/useSalesPersonOptions';

/**
 * @param {{ companyId: number|null, value: number|null, onChange: (employeeId: number) => void }} props
 */
export default function SalesPersonSelect({ companyId, value, onChange }) {
  const { salesPersons, isLoading } = useSalesPersonOptions(companyId);
  const selected = salesPersons.find((p) => p.employee_id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
        >
          <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
            {isLoading ? 'Loading…' : selected ? selected.employee_name : 'Select sales person'}
          </span>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-56 overflow-y-auto">
        {salesPersons.map((p) => (
          <DropdownMenuItem key={p.employee_id} onSelect={() => onChange(p.employee_id)}>
            {p.employee_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
