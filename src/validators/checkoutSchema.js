// src/validators/checkoutSchema.js
import { z } from 'zod';

/**
 * Zod validation schema for the checkout screen (Phase 9b).
 * Source of truth: DEVELOPMENT_PHASES.md Phase 9b, ARCHITECTURE.md Section 12
 *
 * - customerId: a customer session must be attached before order submission
 * - paymentModes: at least one payment mode with a positive amount
 * - totalAmount / cartTotal: split payment amounts must sum to the cart total
 */

const paymentModeSchema = z.object({
  modeId: z.number({ message: 'Payment mode is required' }),
  modeName: z.string().min(1),
  amount: z
    .number({ message: 'Enter an amount' })
    .positive({ message: 'Amount must be greater than 0' }),
});

export const checkoutSchema = z
  .object({
    customerId: z
      .number({ message: 'A customer must be attached before placing the order' })
      .nullable()
      .refine((val) => val !== null, {
        message: 'A customer must be attached before placing the order',
      }),

    // Confirmed 2026-07-16 — the vendor's own POS Sale screen requires
    // selecting an employee before placing the order.
    salesPersonId: z
      .number({ message: 'Select a sales person before placing the order' })
      .nullable()
      .refine((val) => val !== null, {
        message: 'Select a sales person before placing the order',
      }),

    paymentModes: z
      .array(paymentModeSchema)
      .min(1, { message: 'Select at least one payment mode' }),

    totalAmount: z.number().nonnegative(),

    cartTotal: z.number().nonnegative(),
  })
  .refine(
    (data) => {
      const paidTotal = data.paymentModes.reduce((sum, p) => sum + p.amount, 0);
      // Allow up to 1 paisa of float rounding drift
      return Math.abs(paidTotal - data.cartTotal) < 0.01;
    },
    {
      message: 'Payment amounts must add up to the order total',
      path: ['paymentModes'],
    }
  )
  .refine(
    (data) => Math.abs(data.totalAmount - data.cartTotal) < 0.01,
    {
      message: 'Order total mismatch — please refresh and try again',
      path: ['totalAmount'],
    }
  );