// src/services/catalogService.js
// OrnaVerse Catalog + Items module.
// All functions are pure HTTP wrappers — no business logic.
//
// SCHEMA — Inventory.ProductCatalogRow key fields (confirmed v1.json):
//   item_id, item_code, item_name
//   price          — NOT populated on this environment; the app ignores it
//                    and prices live instead (see the PRICING note below)
//   compare_price  — stored "original/MRP" figure. Deliberately unused: it's
//                    another stale master value, and a strikethrough against
//                    a price that no longer matches what's charged misleads.
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
import { calculateItemRates } from '@/services/pricingService';

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
 * Batch-fetches full item detail (including item_rate and item_components[]
 * BOM) for a set of item_ids via Items/List.
 *
 * This exists to feed the live price calculator, NOT to read item_rate off
 * the result — that rate is not a usable price, see the PRICING note below.
 *
 * Items/List supports filtering by `item_ids`, confirmed via direct testing
 * — but confirmed live 2026-07-22 it silently OMITS items with no
 * weight/karat/metal/components at all (genuinely incomplete master records
 * — e.g. a raw-stone entry never given real specs). Those items can't be
 * priced at all and simply stay priceless.
 *
 * @param {number[]} itemIds
 * @returns {Promise<Map<number, object>>} item_id -> full ItemRow
 */
async function getItemDetailsByIds(itemIds) {
  if (!itemIds.length) return new Map();

  const response = await axiosInstance.post(API.ITEMS.LIST, {
    item_ids: itemIds,
    // Exact count needed, not 0 — Take: 0 is not reliably "unlimited" on
    // every list endpoint (see getAllProducts below), so ask for precisely
    // as many rows as there are ids rather than trusting a 0 to mean "all".
    Take: itemIds.length,
  });
  const entities = response.data?.Entities ?? [];
  return new Map(entities.map((e) => [e.item_id, e]));
}

// ── PRICING: ONE SOURCE, NOT A TIER LIST ────────────────────────────────────
//
// Catalog rows leave here with `price: null`. Every price the app shows or
// charges comes from Helpers/SetSalesItems, filled in out-of-band by
// useLiveCatalogPrices → getLivePricesForItems below.
//
// There used to be an attachStaticPrice() tier in front of that, which took
// the item master's stored `item_rate` whenever it was non-zero. It is gone.
// That rate is stale and understates the piece, usually because it predates
// or omits the stone value — measured on UAT 2026-08-05 against what
// SetSalesItems actually charges:
//
//     ADJLR00826              48,704.82  ->  107,840.02   (2.21x)
//     LJ-BR0034-14YGLGD-2.4   54,924.49  ->  109,139.92   (1.99x)
//     LJ-BR0119-14YGLGD-7     13,268.91  ->   40,281.12   (3.04x)
//
// Most items carry item_rate 0 and were already priced live, so this stayed
// invisible until an item with a stale non-zero rate was sold: the counter
// quoted the stale figure, the invoice was raised at the real one, and
// OrnaVerse rejected the short-paid sale ("No credit facility is allowed for
// …"). Undercharging by ~57,000 on one bracelet is the failure mode.
//
// A stored rate that disagrees with the live calculator by 2-3x is not a
// usable price at any tier, so it is no longer offered as one anywhere —
// see also CustomizeSheet and the product detail page, which had the same
// fallback and lost it for the same reason.
//
// The cost is that every item now waits on the background fill-in. That path
// is debounced, chunked and concurrent precisely because SetSalesItems takes
// 6-7+ seconds per ~15-item batch (confirmed 2026-07-28); pages render
// immediately and prices arrive a moment later.

/**
 * Live-computes price for a set of item_ids via Services/Helpers/SetSalesItems
 * (see pricingService.calculateItemRates). This is now the ONLY price source
 * for the catalog — see the PRICING note above for why the stored item_rate
 * was retired.
 *
 * Returns `sub_total` (pre-tax) deliberately: the cart adds GST itself, so a
 * pre-tax unit price makes the cart total land on the invoice's net_amount
 * rather than taxing an already-taxed figure. Confirmed on ADJLR00826 —
 * sub_total 104,699.04 + 3% = 107,840, exactly the invoice's net_amount.
 *
 * A returned 0 is treated as "cannot be priced", not "free", and is left out
 * of the Map. That is the existing contract for uncosted items, and it also
 * keeps Silver925 stock — which OrnaVerse currently prices at 0 in their own
 * POS too — from being displayed, and sold, at nothing.
 *
 * Best-effort: if SetSalesItems has a transient failure (confirmed live
 * 2026-07-22 it can occasionally throw a generic 500), callers get back
 * whatever did resolve rather than an exception — a background price fill-in
 * failing silently is far preferable to it taking down the catalog.
 *
 * @param {number[]} itemIds
 * @returns {Promise<Map<number, number>>} item_id -> live price
 */
export async function getLivePricesForItems(itemIds) {
  const empty = { prices: new Map(), answered: new Set() };
  if (!itemIds?.length) return empty;

  let toPrice;
  try {
    const detailById = await getItemDetailsByIds(itemIds);
    // Every item that came back with a usable master record goes to the
    // calculator. The old filter here (item_rate 0 AND has components) is
    // what let stale non-zero rates through unchecked.
    toPrice = [...detailById.values()];
  } catch (err) {
    console.error('[catalogService] getLivePricesForItems: item lookup failed', err);
    return empty;
  }

  // Items/List omits records with no weight/karat/metal at all. Those can
  // never be priced, so count them as answered rather than retrying forever.
  const returnedIds = new Set(toPrice.map((d) => d.item_id));
  const answered = new Set(itemIds.filter((id) => !returnedIds.has(id)));
  if (!toPrice.length) return { prices: new Map(), answered };

  const prices = new Map();
  const collect = (rows) => {
    for (const r of rows ?? []) {
      // The server ANSWERED for this item even when it priced it at 0 — that
      // is a real "cannot be sold" verdict (currently every Silver925 item),
      // not a failure, so it must not be retried. Distinguishing the two is
      // the point of returning `answered` separately from `prices`.
      answered.add(r.item_id);
      if ((r.sub_total ?? 0) > 0) prices.set(r.item_id, r.sub_total);
    }
  };

  try {
    collect(await calculateItemRates(toPrice));
    return { prices, answered };
  } catch (err) {
    // SetSalesItems can 500 on a single malformed master record (confirmed
    // live 2026-07-22) and it prices the batch as a unit, so one bad item
    // costs the whole batch. Survivable when only BOM items came here; now
    // that every item does, it would blank a whole screen. Re-price
    // individually, in small waves, so the damage is limited to the item
    // that actually fails and we don't fire 24 parallel heavy calls.
    console.error('[catalogService] batch pricing failed, retrying individually', err);

    const WAVE = 4;
    for (let i = 0; i < toPrice.length; i += WAVE) {
      const settled = await Promise.allSettled(
        toPrice.slice(i, i + WAVE).map((item) => calculateItemRates([item]))
      );
      for (const r of settled) {
        if (r.status === 'fulfilled') collect(r.value);
      }
    }
    return { prices, answered };
  }
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

  // Entities pass through unpriced — see the PRICING note above.
  return { ...response.data, Entities: response.data?.Entities ?? [] };
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
  // Unpriced — see the PRICING note above.
  return fetchEntireStoreCatalog(storeId, onProgress);
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
 * @param {{ query: string, storeId: number, signal?: AbortSignal }} params
 *   `signal` lets the caller (useSkuSearch) cancel this request in-flight —
 *   TanStack Query passes a fresh AbortSignal per query and aborts the
 *   previous one automatically when the debounced search text changes, so
 *   wiring it through here means a superseded keystroke's request is
 *   actually cancelled on the wire instead of completing uselessly.
 * @returns {Promise<object[]>} ProductCatalogRow-shaped results
 */
export async function searchBySku({ query, storeId, signal }) {
  if (!query || !storeId) return [];

  const searchResponse = await axiosInstance.post(API.ITEMS.LIST, {
    item_search: query,
    Take: 50,
  }, { signal });
  const candidates = searchResponse.data?.Entities ?? [];
  if (!candidates.length) return [];

  const itemIds = candidates.map((c) => c.item_id);
  const stockData = await getStockByStoresBatch(itemIds, signal);
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
        // null, never item_rate — the stored rate understates the piece by
        // 2-3x (see the PRICING note above). Leaving it null routes this list
        // through the same live tier as the main catalog.
        price:            null,
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
 * @param {AbortSignal} [signal] — optional, cancels the request in-flight
 * @returns {Promise<object>} OrnaVerse batch stock response
 */
export async function getStockByStoresBatch(itemIds, signal) {
  const response = await axiosInstance.post(API.CATALOG.GET_STOCK_BY_STORES_BATCH, {
    item_ids: itemIds,
  }, { signal });
  return response.data;
}