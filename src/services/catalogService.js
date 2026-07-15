// src/services/catalogService.js
// OrnaVerse Catalog + Items module.
// All functions are pure HTTP wrappers — no business logic.
//
// SCHEMA — Inventory.ProductCatalogRow key fields (confirmed v1.json):
//   item_id, item_code, item_name
//   price          — sale price (NOT item_rate — that's on OrderItemsRow)
//   compare_price  — original/MRP price for strikethrough display
//   style_id       — links to StyleRow (which has external_product_id for Shopify)
//   has_stock      — boolean
//   current_company_pieces — stock count at active store
//   total_pieces   — stock count across all stores
//   image, image_1 … image_8 — OrnaVerse image paths (may be null on UAT)
//   type_id, sub_type_id, karat_id, metal_color_id, item_size_id
//   NO external_product_id here — only on StyleRow via Style/Retrieve

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

// ─── ITEMS (Master catalogue) ─────────────────────────────────────────────────

/**
 * Fetches featured items from the master items list.
 * @returns {Promise<object>} { Entities: ItemsRow[] }
 */
export async function getFeaturedItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_featured: true,
    Take:        APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Fetches new-arrival items from the master items list.
 * @returns {Promise<object>} { Entities: ItemsRow[] }
 */
export async function getNewItems() {
  const response = await axiosInstance.post(API.ITEMS.LIST, {
    is_new: true,
    Take:   APP_CONFIG.PAGINATION.DEFAULT_TAKE,
  });
  return response.data;
}

/**
 * Full-text + filter search via master items list.
 * NOTE: Server-side search is unreliable on UAT.
 * Prefer useAllCatalog + client-side filtering for the catalog page.
 * @param {object} params
 */
export async function searchItems(params) {
  const {
    item_search,
    item_group_ids,
    type_ids,
    sub_type_ids,
    from_weight,
    to_weight,
    from_diamond_weight,
    to_diamond_weight,
  } = params;

  const response = await axiosInstance.post(API.ITEMS.LIST, {
    item_search:         item_search         ?? '',
    item_group_ids:      item_group_ids      ?? [],
    type_ids:            type_ids            ?? [],
    sub_type_ids:        sub_type_ids        ?? [],
    brand_ids:           [],
    collection_ids:      [],
    super_type_ids:      [],
    from_weight:         from_weight         ?? null,
    to_weight:           to_weight           ?? null,
    from_diamond_weight: from_diamond_weight ?? null,
    to_diamond_weight:   to_diamond_weight   ?? null,
  });
  return response.data;
}

// ─── CATALOG (Live store inventory) ───────────────────────────────────────────

/**
 * Batch-fetches item_rate for a set of item_ids via Items/List.
 *
 * ProductCatalogRow does NOT reliably return a `price` field on this
 * environment (confirmed 2026-07-15 — Services/Inventory/ProductCatalog/List
 * omits it entirely for every product in at least one store's catalog).
 * item_rate — computed at item creation/costing time — is the real price
 * source; some items have a valid rate baked in, others are 0 because no
 * metal rate was set when they were costed (a data issue, not a bug here).
 * Items/List supports filtering by `item_ids`, confirmed via direct testing.
 *
 * @param {number[]} itemIds
 * @returns {Promise<Map<number, number>>} item_id -> item_rate
 */
async function getItemRatesByIds(itemIds) {
  if (!itemIds.length) return new Map();

  const response = await axiosInstance.post(API.ITEMS.LIST, {
    item_ids: itemIds,
    // Exact count needed, not 0 — Take: 0 is not reliably "unlimited" on
    // every list endpoint (see getAllProducts below), so ask for precisely
    // as many rows as there are ids rather than trusting a 0 to mean "all".
    Take: itemIds.length,
  });
  const entities = response.data?.Entities ?? [];
  return new Map(entities.map((e) => [e.item_id, e.item_rate]));
}

/**
 * Attaches `price` to each ProductCatalogRow, preferring the catalog's own
 * price field when present and falling back to item_rate (see
 * getItemRatesByIds) when it's missing.
 *
 * @param {object[]} entities — ProductCatalogRow[]
 * @returns {Promise<object[]>}
 */
async function enrichWithPrice(entities) {
  if (!entities.length) return entities;

  const needsRate = entities.some((e) => e.price == null);
  if (!needsRate) return entities;

  const itemIds  = entities.map((e) => e.item_id).filter(Boolean);
  const rateById = await getItemRatesByIds(itemIds);

  return entities.map((e) => ({
    ...e,
    // A real jewellery item is never actually free — item_rate === 0 means
    // "not costed yet" (no metal rate at creation time), not "free". Treat
    // it the same as missing so the UI hides the price instead of showing
    // a misleading ₹0.
    price: e.price ?? (rateById.get(e.item_id) || null),
  }));
}

/**
 * Paginated store-scoped product catalog with live stock.
 * Always send current_company_id = activeStoreId.
 *
 * @param {object}  params
 * @param {number}  params.current_company_id   — required
 * @param {number}  [params.Take]
 * @param {number}  [params.Skip]
 * @param {boolean} [params.show_out_of_stock]
 * @param {number[]}[params.type_ids]
 * @returns {Promise<object>} { Entities: ProductCatalogRow[], TotalCount }
 */
export async function getProducts(params) {
  const {
    current_company_id,
    Take              = APP_CONFIG.PAGINATION.CATALOG_TAKE,
    Skip              = 0,
    show_out_of_stock = false,
    ...rest
  } = params;

  const response = await axiosInstance.post(API.CATALOG.GET_PRODUCTS, {
    current_company_id,
    Take,
    Skip,
    show_out_of_stock,
    ...rest,
  });

  const entities = response.data?.Entities ?? [];
  return { ...response.data, Entities: await enrichWithPrice(entities) };
}

/**
 * Fetches this store's ENTIRE product catalog for client-side search,
 * filter, and barcode lookup.
 *
 * Confirmed 2026-07-15: ProductCatalog/List hard-caps at exactly 24 records
 * per request no matter what Take is sent (Take:0, Take:5000 — always 24).
 * There's also no working server-side search on this endpoint at all
 * (item_search/item_code/search params are silently ignored), and the
 * global full-text search on a different endpoint (Items/List ContainsText)
 * can't be reliably scoped to one store's stock — its result ordering has
 * no awareness of which company carries what, so a store's real matches
 * can easily fall outside any practical candidate cap (verified: a genuine
 * "Tennis Bracelet" this store stocks was missed because it wasn't among
 * the first 200 of 756 global matches). So the only reliable option is to
 * paginate this store's own catalog directly, in chunks of the server's
 * real 24-per-request cap, fetched with modest concurrency for speed.
 *
 * TotalCount on this endpoint is NOT trustworthy either — it reports a
 * number far too close to the whole system's item count to be scoped to
 * one company — so completion is detected by an empty/partial page, not by
 * comparing against TotalCount.
 *
 * @param {number} storeId — current_company_id
 * @returns {Promise<object[]>} ProductCatalogRow[]
 */
async function fetchEntireStoreCatalog(storeId, onProgress) {
  const PAGE_SIZE = 24; // the server's real hard cap, confirmed by direct testing
  const CONCURRENCY = 8;
  const SAFETY_MAX_PAGES = 500; // ~12,000 items — generous ceiling against a runaway loop

  const all = [];
  let skip = 0;
  let done = false;
  let pagesFetched = 0;

  while (!done && pagesFetched < SAFETY_MAX_PAGES) {
    const batchSkips = Array.from({ length: CONCURRENCY }, (_, i) => skip + i * PAGE_SIZE);
    const pages = await Promise.all(
      batchSkips.map((s) =>
        axiosInstance
          .post(API.CATALOG.GET_PRODUCTS, {
            current_company_id: storeId,
            Take: PAGE_SIZE,
            Skip: s,
            show_out_of_stock: true,
          })
          .then((res) => res.data?.Entities ?? [])
      )
    );

    for (const entities of pages) {
      pagesFetched++;
      all.push(...entities);
      if (entities.length < PAGE_SIZE) done = true; // partial/empty page = end of data
    }

    onProgress?.(all.length);
    skip += CONCURRENCY * PAGE_SIZE;
  }

  if (pagesFetched >= SAFETY_MAX_PAGES) {
    console.error(
      `[catalogService] fetchEntireStoreCatalog: hit the safety cap of ${SAFETY_MAX_PAGES} pages ` +
      `for store ${storeId} — its real catalog may be larger than what was fetched.`
    );
  }

  return all;
}

/**
 * Full catalog for a store, enriched with price — used for client-side
 * search, filter, and barcode lookup on the catalog page. See
 * fetchEntireStoreCatalog for why this has to paginate rather than rely on
 * a single large Take. Can take a while for a large store — pass onProgress
 * to show a running count while it loads.
 *
 * @param {number} storeId — current_company_id
 * @param {(loaded: number) => void} [onProgress]
 * @returns {Promise<object[]>} ProductCatalogRow[]
 */
export async function getAllProducts(storeId, onProgress) {
  const entities = await fetchEntireStoreCatalog(storeId, onProgress);
  return enrichWithPrice(entities);
}

/**
 * Fast, live SKU search — works at any catalog size, unlike getAllProducts
 * (which has to page through the whole store and can take a while for a
 * large catalog). Items/List's `item_search` is confirmed to match on
 * item_code specifically; results are cross-referenced against this store's
 * real stock the same way as getAllProducts, but the candidate pool here is
 * naturally small (a SKU search is specific), so it stays fast and reliable
 * — unlike a broad name search (e.g. "Tennis"), which can return hundreds
 * or thousands of system-wide matches with no guarantee this store's real
 * matches are among the first N.
 *
 * @param {{ query: string, storeId: number }} params
 * @returns {Promise<object[]>} ProductCatalogRow-shaped results
 */
export async function searchBySku({ query, storeId }) {
  if (!query || !storeId) return [];

  const searchResponse = await axiosInstance.post(API.ITEMS.LIST, {
    item_search: query,
    Take: 50,
  });
  const candidates = searchResponse.data?.Entities ?? [];
  if (!candidates.length) return [];

  const itemIds = candidates.map((c) => c.item_id);
  const stockData = await getStockByStoresBatch(itemIds);
  const stockRows = stockData?.Entities ?? [];

  const stockByItemId = new Map(
    stockRows.filter((row) => row.company_id === storeId)
             .map((row) => [row.item_id, row])
  );

  return candidates
    .filter((c) => stockByItemId.has(c.item_id))
    .map((c) => {
      const stock = stockByItemId.get(c.item_id);
      return {
        item_id:          c.item_id,
        item_code:        c.item_code,
        item_name:        c.item_name,
        type_id:          c.type_id,
        sub_type_id:      c.sub_type_id,
        metal_id:         c.metal_id,
        karat_id:         c.karat_id,
        karat_code:       c.karat_code,
        metal_color_code: c.metal_color_code,
        weight:           stock.weight     ?? c.weight,
        net_weight:       stock.net_weight ?? c.net_weight,
        image:            c.image,
        price:            c.item_rate || null,
        has_stock:              stock.pieces > 0,
        current_company_pieces: stock.pieces ?? 0,
      };
    });
}

/**
 * Cross-store stock for a single item (product detail page).
 * @param {number} itemId — item_id
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export async function getStockByStores(itemId) {
  const response = await axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES, {
    item_id: itemId,
  });
  return response.data;
}

/**
 * Cross-store stock for multiple items in a single call.
 * Use on catalog grid to show availability indicators without N+1 calls.
 * @param {number[]} itemIds — array of item_id values
 * @returns {Promise<object>} OrnaVerse batch stock response
 */
export async function getStockByStoresBatch(itemIds) {
  const response = await axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES_BATCH, {
    item_ids: itemIds,
  });
  return response.data;
}