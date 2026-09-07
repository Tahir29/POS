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
  // ADDED 2026-09-08 — z.object() strips any key not listed here from
  // .safeParse()'s output (no .passthrough(), no .strict() — just the
  // default "silently drop unknown keys" behaviour), so `attributes` and
  // `hasStock` were ALREADY being written by cartSlice.addItem and ALREADY
  // silently discarded before ever reaching Mongo — this schema was out of
  // sync with the real CartItem shape it claims to mirror. productUrl is
  // new (see cartSlice's own comment: every add-to-cart path now derives
  // one, for exactly this — restoring or communicating about an abandoned
  // cart needs a link back to the product, and a photo/specs to recognise
  // it by, not just a bare item_id). All three now actually persist.
  productUrl: z.string().nullable().optional(),
  hasStock:   z.boolean().nullable().optional(),
  attributes: z.object({
    karat:      z.string().nullable().optional(),
    metalColor: z.string().nullable().optional(),
    weight:     z.number().nullable().optional(),
  }).nullable().optional(),
});

export const upsertAbandonedCartSchema = z.object({
  party_id:       z.number().int().positive(),
  customerName:   z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  items:          z.array(abandonedCartItemSchema),
  subtotal:       z.number().nullable().optional(),
  taxAmount:      z.number().nullable().optional(),
  total:          z.number().nullable().optional(),
  // The store active when this snapshot was taken (2026-08-27) — carried
  // through so an abandoned cart isn't just "whose" but also "at which
  // store", same activeStoreId already used everywhere else for scoping.
  // Purely additive: reads/deletes stay keyed on party_id alone, this is
  // just tagged onto the record so the data isn't lost.
  company_id:     z.number().int().positive().nullable().optional(),
});
