// Today's live per-karat metal rates — the highlighted strip shown under
// OrnaVerse POS's own header. KARAT_RATES is a deliberately hardcoded list:
// GetMetalRate takes a specific karat_id with no "list all configured
// karats" mode, and the endpoint that looks like a list
// (Services/Costing/KaratRates/List) returns empty regardless of params —
// OrnaVerse's own client evidently just fires one GetMetalRate per known id.
// Labels are OrnaVerse's own raw codes ("09", "14", "925", "S999", ...),
// intentionally not translated to "14KT"/"Silver 925"/etc — see this file's
// entry in project history for the full derivation of the id/code mapping.

import { useQueries } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { getMetalRate } from '@/services/settingsService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { QUERY_KEYS } from '@/constants/queryKeys';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

// karat_id -> raw code, in on-screen order.
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
  // Use the local-calendar-day date, not UTC, so the cache key rolls over
  // at local midnight rather than ~5:30am IST — see todayDateString().
  const dateKey = todayDateString();

  const results = useQueries({
    queries: KARAT_RATES.map(({ karatId }) => ({
      queryKey:  QUERY_KEYS.SETTINGS.METAL_RATE(karatId, companyId, dateKey),
      queryFn:   () => getMetalRate({ karatId, companyId }),
      enabled:   !!companyId,
      staleTime: APP_CONFIG.STALE_TIME.STOCK, // rates can move intraday
      select:    (data) => (typeof data?.rate === 'number' ? data.rate : null),
    })),
  });

  const rates = KARAT_RATES.map(({ code }, i) => ({
    code,
    rate:      results[i].data ?? null,
    isLoading: results[i].isLoading,
    isError:   results[i].isError,
  }));

  const hasAny = rates.some((r) => r.rate != null);

  return {
    rates,
    // Stay "loading" until either something resolves (hasAny) or every call
    // has settled — `.isLoading` alone flips false on error too, which would
    // hide the strip while other calls are still in flight.
    isLoading: !hasAny && results.some((r) => r.isLoading),
    hasAny,
  };
}
