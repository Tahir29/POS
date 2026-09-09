// src/validators/abandonedCartSchema.js
//
// Guards the abandoned-cart request bodies. Mirrors CartItem's real shape
// (see store/slices/cartSlice.js's addItem reducer) explicitly, same
// reasoning as recentlyViewedSchema.js: this is OUR shape, generated
// client-side from the live cart, not mirrored from OrnaVerse, so there's
// no drift risk in enumerating it.
//
// FIXED 2026-09-09 — every numeric field here used strict z.number(),
// which Zod rejects outright the moment a value arrives as a numeric
// STRING ("2", not 2) rather than a real JS number — confirmed live this
// is exactly what was silently failing every abandoned-cart save with a
// 400 ("items: Invalid input: expected number, received string"), while
// the architecturally-identical recentlyViewed/wishlist saves happened to
// keep working (their real-world payloads just hadn't hit this yet).
// caller's own fetch never checked the response status either (see
// abandonedCartMiddleware.js's own fix), so this had been failing
// completely invisibly. Switched every numeric field to z.coerce.number()
// — accepts "2" and 2 alike — since this data is a display/marketing
// snapshot only (see this file's own trust-boundary note elsewhere in the
// codebase: nothing here is re-verified against OrnaVerse), so leniency
// costs nothing and the alternative is silently losing real customer data
// over a type an operator never controlled in the first place. Zod's
// .nullable()/.optional() intercept a literal null/undefined BEFORE the
// inner z.coerce.number() ever runs, so a genuinely-absent value still
// stays null/undefined rather than being coerced to 0 — only a
// present-but-string value gets coerced.

import { z } from 'zod';

const numeric = () => z.coerce.number();

export const abandonedCartItemSchema = z.object({
  itemId:     numeric().int().positive(),
  itemCode:   z.string().nullable().optional(),
  itemName:   z.string().nullable().optional(),
  sku:        z.string().nullable().optional(),
  quantity:   numeric().int().positive(),
  unitPrice:  numeric().nullable().optional(),
  styleId:    numeric().int().nullable().optional(),
  sizeId:     numeric().int().nullable().optional(),
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
  // EXPANDED 2026-09-08 — `attributes` used to be a 3-field
  // { karat, metalColor, weight } object; AddToCartButton.jsx now stores
  // the FULL shared productAttributes.js output here instead (see that
  // file's own header) so an abandoned-cart retargeting message has the
  // same full product detail — gemstone, price breakup, dimensions,
  // per-piece sku — that every other product event already carries, not
  // just three fields. Every key optional/nullable, same "consistent,
  // predictable schema" reasoning productAttributes.js's own header gives
  // for defaulting every field to null rather than omitting it.
  attributes: z.object({
    item_id:     numeric().int().nullable().optional(),
    item_code:   z.string().nullable().optional(),
    item_name:   z.string().nullable().optional(),
    sku:         z.string().nullable().optional(),
    style_id:    numeric().int().nullable().optional(),
    image:       z.string().nullable().optional(),
    product_url: z.string().nullable().optional(),
    has_stock:   z.boolean().nullable().optional(),

    item_group_name: z.string().nullable().optional(),
    category:        z.string().nullable().optional(),
    sub_category:    z.string().nullable().optional(),
    collection:      z.string().nullable().optional(),
    brand:           z.string().nullable().optional(),
    hsn:             z.string().nullable().optional(),

    metal:       z.string().nullable().optional(),
    karat:       z.string().nullable().optional(),
    metal_color: z.string().nullable().optional(),

    size_id:   numeric().int().nullable().optional(),
    size_name: z.string().nullable().optional(),

    gross_weight: numeric().nullable().optional(),
    net_weight:   numeric().nullable().optional(),
    stone_weight:       numeric().nullable().optional(),
    diamond_weight:     numeric().nullable().optional(),
    color_stone_weight: numeric().nullable().optional(),
    other_weight:       numeric().nullable().optional(),
    diamond_pieces:     numeric().nullable().optional(),
    stone_pieces:       numeric().nullable().optional(),
    color_stone_pieces: numeric().nullable().optional(),
    other_pieces:       numeric().nullable().optional(),

    height: numeric().nullable().optional(),
    width:  numeric().nullable().optional(),
    length: numeric().nullable().optional(),
    depth:  numeric().nullable().optional(),

    gemstone_type:  z.string().nullable().optional(),
    gemstone_shape: z.string().nullable().optional(),
    gemstone_color: z.string().nullable().optional(),
    gemstone_size:  z.string().nullable().optional(),

    price_metal_amount:       numeric().nullable().optional(),
    price_diamond_amount:     numeric().nullable().optional(),
    price_stone_amount:       numeric().nullable().optional(),
    price_color_stone_amount: numeric().nullable().optional(),
    price_other_amount:       numeric().nullable().optional(),
    price_making_charges:     numeric().nullable().optional(),
    price_sub_total:          numeric().nullable().optional(),
    price_taxable_amount:     numeric().nullable().optional(),
    price_tax_amount:         numeric().nullable().optional(),
    price_net_amount:         numeric().nullable().optional(),
  }).nullable().optional(),
});

export const upsertAbandonedCartSchema = z.object({
  party_id:       numeric().int().positive(),
  customerName:   z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  items:          z.array(abandonedCartItemSchema),
  subtotal:       numeric().nullable().optional(),
  taxAmount:      numeric().nullable().optional(),
  total:          numeric().nullable().optional(),
  // The store active when this snapshot was taken (2026-08-27) — carried
  // through so an abandoned cart isn't just "whose" but also "at which
  // store", same activeStoreId already used everywhere else for scoping.
  // Purely additive: reads/deletes stay keyed on mobile (see
  // lib/mongo/abandonedCart.js), this is just tagged onto the record so
  // the data isn't lost.
  company_id:     numeric().int().positive().nullable().optional(),
});
