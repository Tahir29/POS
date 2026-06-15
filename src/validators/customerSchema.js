// src/validators/customerSchema.js
import { z } from 'zod';

/**
 * Zod validation schema for customer lookup (header Customer Session) and
 * new customer creation (NewCustomerForm).
 * Source of truth: ARCHITECTURE.md Section 13, API_MAPPING.md Section 9.2
 */

// 10-digit Indian mobile number, digits only (no country code prefix)
export const mobileSchema = z
  .string()
  .min(1, { message: 'Mobile number is required' })
  .regex(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit mobile number' });

export const customerSchema = z.object({
  first_name: z
    .string()
    .min(1, { message: 'First name is required' }),

  last_name: z
    .string()
    .min(1, { message: 'Last name is required' }),

  phone: mobileSchema,

  email: z
    .string()
    .email({ message: 'Enter a valid email address' })
    .optional()
    .or(z.literal('')),

  address: z.string().optional().or(z.literal('')),
  city:    z.string().optional().or(z.literal('')),
  state:   z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  zip:     z.string().optional().or(z.literal('')),
});