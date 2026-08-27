// Today's live per-karat metal rates — the same highlighted strip
// OrnaVerse's own POS shows directly under its header (confirmed live
// 2026-08-27, lucira.uat.ornaverse.in/pos — this UAT tenant IS Lucira's own
// ERP backend, not a separate demo, so every id captured below is this
// app's own real tenant master data, not borrowed from someone else's).
//
// THE KARAT LIST IS HARDCODED, DELIBERATELY. GetMetalRate needs a specific
// karat_id up front — it has no "give me every configured karat" mode — and
// the one endpoint that LOOKS like a list (Services/Costing/KaratRates/List)
// came back empty in the same live capture regardless of params. OrnaVerse's
// own client evidently already knows its karat_ids ahead of time (there's no
// public "list karats" call in their network trace either) — it just fires
// one GetMetalRate per id. KARAT_RATES below is that same fixed set, in the
// same order, confirmed by matching each captured request's karat_id to the
// rate value shown at that position on their own screen (both card values
// AND request order lined up exactly — e.g. karat_id 85 always returned
// 9440, displayed as "14: ₹9,440.00/g", 4th network call = 4th strip entry).
//
// LABELS ARE THE RAW CODES ORNAVERSE ITSELF SHOWS ("09", "14", "925",
// "S999", ...) — deliberately NOT translated to "14KT"/"Silver 925"/etc.
// Every one of these calls used the SAME item_group_id (106 — this app's
// own APP_CONFIG.METAL_TYPES.GOLD), which rules out "925/995/999 are
// Silver" as confidently as it rules out anything else; they read like
// GOLD fineness-per-mille notations instead (999‰ ≈ 24K), consistent with
// the rate figures (₹15,984–16,000/g, close to what 14KT's ₹9,440/g scales
// to at higher purity) — but this is inference, not confirmed by a
// resolved name from the API. Matching their own unlabeled display exactly
// is the only claim this makes that's actually verified.

import { useQueries } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getMetalRate } from '@/services/settingsService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';

// karat_id -> raw code, in on-screen order, captured live 2026-08-27.
const KARAT_RATES = [
  { karatId: 835,  code: '09'   },
  { karatId: 85,   code: '14'   },
  { karatId: 86,   code: '18'   },
  { karatId: 87,   code: '22'   },
  { karatId: 1595, code: '916'  },
  { karatId: 88,   code: '925'  },
  { karatId: 89,   code: '95'   },
  { karatId: 1132, code: '995'  },
  { karatId: 1133, code: '999'  },
  { karatId: 0,    code: 'NA'   },
  { karatId: 1755, code: 'S999' },
];

/**
 * @returns {{
 *   rates: { code: string, rate: number|null, isLoading: boolean, isError: boolean }[],
 *   isLoading: boolean,  — true only until the FIRST rate resolves, so the
 *     strip can render progressively rather than waiting on all 11 calls.
 *   hasAny: boolean,     — at least one rate resolved; the strip renders
 *     nothing at all otherwise rather than a row of blank cards.
 * }}
 */
export function useMetalRates() {
  const companyId = useSelector(selectActiveStoreId);
  const dateKey = new Date().toISOString().slice(0, 10); // rolls the cache key at midnight, no timer needed

  const results = useQueries({
    queries: KARAT_RATES.map(({ karatId }) => ({
      queryKey:  QUERY_KEYS.SETTINGS.METAL_RATE(karatId, companyId, dateKey),
      queryFn:   () => getMetalRate({ karatId, companyId }),
      enabled:   !!companyId,
      staleTime: APP_CONFIG.STALE_TIME.STOCK, // rates can move intraday — see checkoutPricingService's own note on this
      select:    (data) => (typeof data?.rate === 'number' ? data.rate : null),
    })),
  });

  const rates = KARAT_RATES.map(({ code }, i) => ({
    code,
    rate:      results[i].data ?? null,
    isLoading: results[i].isLoading,
    isError:   results[i].isError,
  }));

  return {
    rates,
    isLoading: results.every((r) => r.isLoading),
    hasAny:    rates.some((r) => r.rate != null),
  };
}
