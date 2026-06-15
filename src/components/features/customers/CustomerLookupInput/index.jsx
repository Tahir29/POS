'use client';

// src/components/features/customer/CustomerLookupInput/index.jsx
// Mobile number input + search button for customer lookup.
// Validates via mobileSchema before triggering the lookup query.

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mobileSchema } from '@/validators/customerSchema';

/**
 * @param {{
 *   onSearch: (mobile: string) => void,
 *   isLoading?: boolean,
 * }} props
 */
export default function CustomerLookupInput({ onSearch, isLoading = false }) {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobile(value);
    if (error) setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = mobileSchema.safeParse(mobile);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid mobile number');
      return;
    }
    onSearch(mobile);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="Enter 10-digit mobile number"
          value={mobile}
          onChange={handleChange}
          aria-label="Customer mobile number"
          aria-invalid={!!error}
          className="h-11"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 min-w-[44px] px-4"
          aria-label="Search customer"
        >
          <Search size={18} aria-hidden="true" />
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </form>
  );
}