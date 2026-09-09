// src/validators/wishlistSchema.js
//
// Guards the wishlist request bodies. Mirrors recentlyViewedSchema.js's
// item shape exactly — same fields ProductCard needs to render itself
// (see that component's own field list), since a wishlisted item is
// rendered by the exact same component wherever it shows up (catalog grid,
// RecentlyViewedCarousel, the customer profile's Wishlist tab).
//
// FIXED 2026-09-09 — numeric fields switched from z.number() to
// z.coerce.number(), same fix and same reason as abandonedCartSchema.js's
// own comment: a numeric-string value used to fail validation outright
// instead of being accepted. Fixed proactively here alongside its two
// siblings (identical item shape, same risk) rather than waiting for this
// one's own live failure.

import { z } from 'zod';

const numeric = () => z.coerce.number();

export const wishlistItemSchema = z.object({
  item_id:    numeric().int().positive(),
  item_code:  z.string().nullable().optional(),
  item_name:  z.string().nullable().optional(),
  image:      z.string().nullable().optional(),
  image_url:  z.string().nullable().optional(),
  image_1:    z.string().nullable().optional(),
  metal_id:   numeric().int().nullable().optional(),
  karat_code: z.string().nullable().optional(),
  // metal_color_code/metal_color_name (2026-08-23) — see the identical
  // fields in recentlyViewedSchema.js and lib/metalColor.js: catalog rows
  // only carry the short code (e.g. "YG"), Items/Retrieve only carries the
  // full name ("Yellow Gold") — a wishlisted item can be added from either
  // surface (catalog card or the product detail page's own heart), so both
  // are accepted.
  metal_color_code: z.string().nullable().optional(),
  metal_color_name: z.string().nullable().optional(),
  has_stock:  z.boolean().nullable().optional(),
  net_weight: numeric().nullable().optional(),
  weight:     numeric().nullable().optional(),
  style_id:   numeric().int().nullable().optional(),
  // item_size_id/item_size_name (2026-08-24) — a wishlisted item can be a
  // CONFIRMED customization (e.g. Customize → 18KT White Gold, Size 7 →
  // then the heart), not just the bare base design. Without these, sizing
  // a customer picked before wishlisting was silently dropped — see the
  // product detail page's wishlistProduct comment for the full fix.
  item_size_id:   numeric().int().nullable().optional(),
  item_size_name: z.string().nullable().optional(),
});

export const addWishlistItemSchema = z.object({
  party_id:       numeric().int().positive(),
  customerName:   z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  item:           wishlistItemSchema,
});
