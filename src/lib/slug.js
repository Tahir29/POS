// src/lib/slug.js
//
// Readable URLs for the customer and product detail pages — was a bare
// numeric id (`/customers/12345`, `/products/52788`); now a name-first slug
// with the id kept as a trailing suffix (`/customers/tahir-kutty-12345`,
// `/products/celestial-round-diamond-necklace-52788`).
//
// WHY THE ID IS STILL THERE, NOT A PURE NAME: both detail pages fetch by a
// numeric EntityId (Customer/Retrieve, Items/Retrieve — confirmed in
// customerService.js/itemService.js, neither has any lookup-by-name path),
// and neither a customer name nor a product name is guaranteed unique —
// two customers can share a name, and a style's colour/karat variants
// often share the base item_name outright. A pure-name URL would either
// require a global uniqueness guarantee this data doesn't have, or resolve
// to the wrong record the moment two things share a name. Keeping the id
// as a suffix is the standard "slug-id" pattern for exactly this reason
// (Shopify's own admin does the same) — the browser address bar reads as
// the customer/product name, and the lookup underneath is still exact and
// collision-proof.
//
// BACKWARD COMPATIBLE: parseIdFromSlug reads the trailing digits off
// EITHER shape — "tahir-kutty-12345" (new links) or a bare "12345" (any
// link/bookmark saved before this change) — both resolve to the same id.

/**
 * @param {string|null|undefined} text
 * @returns {string} lowercase, hyphen-separated, alphanumeric only — '' if
 *   nothing usable was in `text` (caller decides the fallback, see buildSlug)
 */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {string|null|undefined} name — customer/item name, may be missing
 * @param {number|string|null|undefined} id — the real EntityId
 * @returns {string} e.g. "tahir-kutty-12345", or just "12345" if `name`
 *   didn't slugify to anything (blank/unrecognised-characters name) — a
 *   URL with no readable name is still a correct, working link.
 */
export function buildSlug(name, id) {
  const base = slugify(name);
  if (id == null) return base;
  return base ? `${base}-${id}` : String(id);
}

/**
 * @param {string|string[]|null|undefined} slug — the raw route param value
 *   (Next.js hands back a string for a single dynamic segment)
 * @returns {number|null} the trailing numeric id, or null if none is found
 *   (a genuinely malformed URL — nothing to fetch)
 */
export function parseIdFromSlug(slug) {
  const str = Array.isArray(slug) ? slug[0] : slug;
  if (!str) return null;
  const match = String(str).match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}
