// src/validators/wishlistSchema.js
//
// Guards the wishlist request bodies. Mirrors recentlyViewedSchema.js's
// item shape exactly — same fields ProductCard needs to render itself
// (see that component's own field list), since a wishlisted item is
// rendered by the exact same component wherever it shows up (catalog grid,
// RecentlyViewedCarousel, the customer profile's Wishlist tab).

import { z } from 'zod';

export const wishlistItemSchema = z.object({
  item_id:    z.number().int().positive(),
  item_code:  z.string().nullable().optional(),
  item_name:  z.string().nullable().optional(),
  image:      z.string().nullable().optional(),
  image_url:  z.string().nullable().optional(),
  image_1:    z.string().nullable().optional(),
  metal_id:   z.number().int().nullable().optional(),
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
  net_weight: z.number().nullable().optional(),
  weight:     z.number().nullable().optional(),
  style_id:   z.number().int().nullable().optional(),
  // item_size_id/item_size_name (2026-08-24) — a wishlisted item can be a
  // CONFIRMED customization (e.g. Customize → 18KT White Gold, Size 7 →
  // then the heart), not just the bare base design. Without these, sizing
  // a customer picked before wishlisting was silently dropped — see the
  // product detail page's wishlistProduct comment for the full fix.
  item_size_id:   z.number().int().nullable().optional(),
  item_size_name: z.string().nullable().optional(),
});

export const addWishlistItemSchema = z.object({
  party_id:       z.number().int().positive(),
  customerName:   z.string().nullable().optional(),
  customerMobile: z.string().nullable().optional(),
  item:           wishlistItemSchema,
});
