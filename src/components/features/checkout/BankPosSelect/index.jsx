'use client';

// Bank account picker for a bank-settled payment mode (Credit Card, Debit
// Card, UPI) at checkout. Not shown for Cash. Plain controlled
// value/onChange component, same convention as SalesPersonSelect.

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useBankPosAccounts } from '@/hooks/checkout/useBankPosAccounts';

/**
 * @param {{ value: number|null, onChange: (bankPosId: number) => void }} props
 */
export default function BankPosSelect({ value, onChange }) {
  const { bankPosAccounts, isLoading } = useBankPosAccounts();

  return (
    <Select
      value={value != null ? String(value) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={isLoading}
    >
      <SelectTrigger className="h-10 w-full">
        <SelectValue placeholder={isLoading ? 'Loading…' : 'Select bank account'} />
      </SelectTrigger>
      <SelectContent className="max-h-56 overflow-y-auto">
        {bankPosAccounts.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
