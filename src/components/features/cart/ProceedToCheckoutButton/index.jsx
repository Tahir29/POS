'use client';

// src/components/features/cart/ProceedToCheckoutButton/index.jsx
// CTA navigating to the checkout screen. Disabled when cart is empty.
// Checkout route/screen itself is built in Phase 9.

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

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
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Proceed to Checkout"
      className="
        flex w-full items-center justify-center gap-2
        min-h-[52px] px-6 rounded-xl
        text-base font-semibold
        bg-primary hover:bg-primary/90 active:scale-[0.98]
        text-primary-foreground shadow-sm hover:shadow-md
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      Proceed to Checkout
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );
}