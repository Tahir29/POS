// src/validators/abandonedCartSchema.js
//
// Guards the abandoned-cart request bodies. Mirrors CartItem's real shape
// (see store/slices/cartSlice.js's addItem reducer) explicitly, same
// reasoning as recentlyViewedSchema.js: this is OUR shape, generated
// client-side from the live cart, not mirrored from OrnaVerse, so there's
// no drift risk in enumerating it.

import { z } from 'zod';

export const abandonedCartItemSchema = z.object({
  itemId:     z.number().int().positive(),
  itemCode:   z.string().nullable().optional(),
  itemName:   z.string().nullable().optional(),
  sku:        z.string().nullable().optional(),
  quantity:   z.number().int().positive(),
  unitPrice:  z.number().nullable().optional(),
  styleId:    z.number().int().nullable().optional(),
  sizeId:     z.number().int().nullable().optional(),
  sizeName:   z.string().nullable().optional(),
  image:      z.string().nullable().optional(),
});

export const upsertAbandonedCartSchema = z.object({
  party_id:       z.number().int().positive(),
  customerName:   z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  items:          z.array(abandonedCartItemSchema),
  subtotal:       z.number().nullable().optional(),
  taxAmount:      z.number().nullable().optional(),
  total:          z.number().nullable().optional(),
});
