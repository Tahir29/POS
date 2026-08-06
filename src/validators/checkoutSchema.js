// src/validators/checkoutSchema.js
import { z } from 'zod';
import { PAN_REGEX } from '@/validators/customerSchema';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Zod validation schema for the checkout screen (Phase 9b).
 * Source of truth: DEVELOPMENT_PHASES.md Phase 9b, ARCHITECTURE.md Section 12
 *
 * - customerId: a customer session must be attached before order submission
 * - paymentModes: at least one payment mode with a positive amount
 * - totalAmount / cartTotal: split payment amounts must sum to the total
 * - allowPartialPayment: true when raising an ORDER (doc 53) rather than an
 *   invoice. An order is a booking against which the customer leaves an
 *   advance, so anything from one rupee up to the full value is valid and the
 *   remainder is carried as balance_amount. An INVOICE has no such latitude —
 *   OrnaVerse refuses a short-paid one outright ("No credit facility is
 *   allowed for …"), so it still has to balance to the rupee.
 * - panNumber: mandatory once totalAmount crosses the statutory PAN
 *   threshold (Income Tax Rule 114B) — see APP_CONFIG.COMPLIANCE. Either
 *   already on the customer's record or entered fresh at checkout; the page
 *   resolves that into a single `panNumber` before validating here.
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

    // Emptiness is checked in superRefine, not here: an ORDER may legitimately
    // be placed with no payment at all — their own counter says so outright
    // ("No advance required — you can place the order without collecting
    // payment"). An INVOICE still needs at least one mode.
    paymentModes: z.array(paymentModeSchema),

    totalAmount: z.number().nonnegative(),

    cartTotal: z.number().nonnegative(),

    // Already-on-file or freshly-entered-and-valid PAN — null is fine below
    // the statutory threshold, required above it.
    panNumber: z.string().nullable(),

    allowPartialPayment: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const paidTotal = data.paymentModes.reduce((sum, p) => sum + p.amount, 0);

    // Allow up to 1 paisa of float rounding drift throughout.
    if (data.allowPartialPayment) {
      // Zero is fine — the whole value is then carried as balance_amount and
      // collected when the piece is handed over.
      if (paidTotal > data.cartTotal + 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Advance cannot be more than the order total',
          path: ['paymentModes'],
        });
      }
      return;
    }

    if (data.paymentModes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one payment mode',
        path: ['paymentModes'],
      });
      return;
    }

    if (Math.abs(paidTotal - data.cartTotal) >= 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment amounts must add up to the order total',
        path: ['paymentModes'],
      });
    }
  })
  .refine(
    (data) => Math.abs(data.totalAmount - data.cartTotal) < 0.01,
    {
      message: 'Order total mismatch — please refresh and try again',
      path: ['totalAmount'],
    }
  )
  .refine(
    (data) => {
      if (data.totalAmount <= APP_CONFIG.COMPLIANCE.PAN_MANDATORY_THRESHOLD) return true;
      return !!data.panNumber && PAN_REGEX.test(data.panNumber);
    },
    {
      message: `PAN is mandatory for orders above ₹${APP_CONFIG.COMPLIANCE.PAN_MANDATORY_THRESHOLD.toLocaleString('en-IN')}`,
      path: ['panNumber'],
    }
  );