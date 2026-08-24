// src/lib/catalogSort.js
//
// Extracted from catalog/page.jsx (2026-08-24) so the "Available at other
// stores" section (OtherStoreSection) can sort its own list the exact same
// way the primary catalog grid does, instead of drifting out of sync with a
// second, hand-copied comparator.

export function getWeight(product) {
  return product.net_weight ?? product.weight ?? 0;
}

export function getPrice(product) {
  return product.price ?? null;
}

/**
 * Shared comparator for both search-mode and browse-mode sorting.
 * Items with no price (not every product has one — see
 * catalogService.enrichWithPrice) always sort after priced ones,
 * regardless of ascending/descending direction.
 */
export function compareProducts(a, b, sortBy) {
  switch (sortBy) {
    case 'name_asc':  return (a.item_name ?? '').localeCompare(b.item_name ?? '');
    case 'name_desc': return (b.item_name ?? '').localeCompare(a.item_name ?? '');
    case 'price_asc':
    case 'price_desc': {
      const pa = getPrice(a);
      const pb = getPrice(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sortBy === 'price_asc' ? pa - pb : pb - pa;
    }
    case 'weight_asc':  return getWeight(a) - getWeight(b);
    case 'weight_desc': return getWeight(b) - getWeight(a);
    default: return 0;
  }
}

/**
 * THE ONLY sort step, for both browse and search mode (and now the
 * other-stores lane too), applied ONCE — after live prices are merged in.
 * Sorting unpriced rows straight off the catalog/inventory endpoints made
 * price_asc/price_desc a no-op (comparing null against null); this must
 * only ever run after a price has been merged onto each row.
 */
export function sortProducts(products, sortBy) {
  return [...products].sort((a, b) => compareProducts(a, b, sortBy));
}
