'use client';

// src/components/features/checkout/SalesPersonSelect/index.jsx
// "Sales Person" picker for checkout — mirrors the same field on the
// vendor's own POS Sale screen (confirmed 2026-07-16: they select an
// employee name before placing the order). Reuses useSalesPersonOptions,
// the same store-scoped Employee/List picker already used and confirmed
// working on Scheme Enrollment — not duplicated here.
//
// Plain controlled component (value/onChange), not react-hook-form bound —
// checkout/page.jsx drives it with local state. schemes/enroll/page.jsx
// wraps it in a Controller to reuse the same picker within its RHF form.

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useSalesPersonOptions } from '@/hooks/schemes/useSalesPersonOptions';

/**
 * @param {{ companyId: number|null, value: number|null, onChange: (employeeId: number) => void }} props
 */
export default function SalesPersonSelect({ companyId, value, onChange }) {
  const { salesPersons, isLoading } = useSalesPersonOptions(companyId);

  return (
    <Select
      value={value != null ? String(value) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={isLoading}
    >
      <SelectTrigger className="h-11 w-full">
        <SelectValue placeholder={isLoading ? 'Loading…' : 'Select sales person'} />
      </SelectTrigger>
      <SelectContent className="max-h-56 overflow-y-auto">
        {salesPersons.map((p) => (
          <SelectItem key={p.employee_id} value={String(p.employee_id)}>
            {p.employee_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
