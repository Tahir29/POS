'use client';

// src/components/features/customer/CustomerLookupInput/index.jsx
// Free-text search + button for customer lookup: a 10-digit number
// triggers an exact mobile lookup, any other text (2+ chars) triggers a
// name search across the customer directory. Mirrors the search behavior
// already used on the /customers directory page.

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import APP_CONFIG from '@/constants/appConfig';

const MOBILE_REGEX = /^\d{10}$/;

/**
 * @param {{
 *   onSearch: (query: string) => void,
 *   isLoading?: boolean,
 * }} props
 */
export default function CustomerLookupInput({ onSearch, isLoading = false }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setValue(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    const isMobile = MOBILE_REGEX.test(trimmed);
    if (!isMobile && trimmed.length < APP_CONFIG.SEARCH.MIN_QUERY_LENGTH) {
      setError('Enter a 10-digit mobile number or at least 2 characters of a name');
      return;
    }
    onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="search"
          placeholder="Search by name or mobile number"
          value={value}
          onChange={handleChange}
          aria-label="Customer name or mobile number"
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
