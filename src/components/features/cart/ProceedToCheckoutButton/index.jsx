'use client';

// src/components/features/cart/ProceedToCheckoutButton/index.jsx
// CTA navigating to the checkout screen. Disabled when cart is empty.
// Checkout route/screen itself is built in Phase 9.

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @param {{
 *   disabled?: boolean,
 *   onNavigate?: () => void,
 * }} props
 *   onNavigate - optional callback fired before navigating (e.g. close drawer)
 */
export default function ProceedToCheckoutButton({ disabled, onNavigate }) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    onNavigate?.();
    router.push('/checkout');
  };

  return (
    <Button
      type="button"
      variant="premium"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Proceed to Checkout"
      className="w-full min-h-[52px] px-6 text-base font-semibold"
    >
      Proceed to Checkout
      <ArrowRight size={18} aria-hidden="true" />
    </Button>
  );
}
