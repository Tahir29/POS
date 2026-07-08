// src/validators/customerSchema.js
// Zod schemas for customer create and update forms.
//
// POS.CustomerRow confirmed field names (v1.json):
//   party_name   — full name (single field, not first/last split)
//   mobile       — 10-digit mobile
//   email        — optional
//   pan_no       — optional PAN card (NOT pan)
//   address      — address line 1
//   address_1    — address line 2
//   city_id      — numeric ID (from Cities/List)
//   state_id     — numeric ID (from States/List)
//   country_id   — numeric ID (from Countries/List)
//   pin_code     — postal code string
//   birth_date   — ISO datetime string
//   anniversary  — ISO datetime string
//   gender       — enum int
//   marital_status — enum int

import { z } from 'zod';

// ── Mobile ─────────────────────────────────────────────────────────────────────
// 10-digit Indian mobile, must start with 6-9
export const mobileSchema = z
  .string()
  .min(1, { message: 'Mobile number is required' })
  .regex(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit mobile number' });

// ── Create Customer ────────────────────────────────────────────────────────────
// Used by NewCustomerForm
export const customerSchema = z.object({
  party_name: z
    .string()
    .min(1, { message: 'Customer name is required' })
    .max(100, { message: 'Name is too long' }),

  mobile: mobileSchema,

  email: z
    .string()
    .email({ message: 'Enter a valid email address' })
    .optional()
    .or(z.literal('')),

  pan_no: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Enter a valid PAN (e.g. ABCDE1234F)' })
    .optional()
    .or(z.literal('')),

  address:   z.string().optional().or(z.literal('')),
  address_1: z.string().optional().or(z.literal('')),

  // Cascading location — IDs from location master
  // Optional on create, required only if address is provided
  country_id: z.number().int().positive().optional().nullable(),
  state_id:   z.number().int().positive().optional().nullable(),
  city_id:    z.number().int().positive().optional().nullable(),

  pin_code: z
    .string()
    .regex(/^\d{6}$/, { message: 'Enter a 6-digit PIN code' })
    .optional()
    .or(z.literal('')),

  birth_date:  z.string().optional().or(z.literal('')),
  anniversary: z.string().optional().or(z.literal('')),

  // gender: 1=Male, 2=Female, 3=Other (OrnaVerse enum)
  gender: z.number().int().optional().nullable(),

  // marital_status: 1=Single, 2=Married (OrnaVerse enum)
  marital_status: z.number().int().optional().nullable(),
});

// ── Update Customer ────────────────────────────────────────────────────────────
// Used by EditCustomerForm inside CustomerDetailSheet
// All fields optional — only changed fields need to be present in the form
// But buildCustomerUpdatePayload() merges with original raw before sending
export const updateCustomerSchema = z.object({
  party_name: z
    .string()
    .min(1, { message: 'Customer name is required' })
    .max(100, { message: 'Name is too long' }),

  mobile: mobileSchema,

  email: z
    .string()
    .email({ message: 'Enter a valid email address' })
    .optional()
    .or(z.literal('')),

  pan_no: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Enter a valid PAN (e.g. ABCDE1234F)' })
    .optional()
    .or(z.literal('')),

  address:   z.string().optional().or(z.literal('')),
  address_1: z.string().optional().or(z.literal('')),

  country_id: z.number().int().positive().optional().nullable(),
  state_id:   z.number().int().positive().optional().nullable(),
  city_id:    z.number().int().positive().optional().nullable(),

  pin_code: z
    .string()
    .regex(/^\d{6}$/, { message: 'Enter a 6-digit PIN code' })
    .optional()
    .or(z.literal('')),

  birth_date:     z.string().optional().or(z.literal('')),
  anniversary:    z.string().optional().or(z.literal('')),
  gender:         z.number().int().optional().nullable(),
  marital_status: z.number().int().optional().nullable(),
});