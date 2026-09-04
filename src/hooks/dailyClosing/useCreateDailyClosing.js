// No Post step — Create is terminal per API design.
//
// ENRICHED 2026-09-04 — store_id was entirely absent from both events. No
// customer is ever attached for a daily closing (it's an agent/store-level
// action, not a customer transaction), so useSessionTrackingContext's
// customer_id will always read 'guest' here — that's correct, not a gap.
// DAILY_CLOSING_FAILED additionally carried no sales-figures context at
// all, only the raw error, unlike its own success twin.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { createDailyClosing } from '@/services/dailyClosingService';
import { useSessionTrackingContext } from '@/hooks/analytics/useSessionTrackingContext';
import { QUERY_KEYS } from '@/constants/queryKeys';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

export function useCreateDailyClosing() {
  const queryClient = useQueryClient();
  const sessionCtx = useSessionTrackingContext();

  return useMutation({
    mutationFn: (closingEntity) => createDailyClosing(closingEntity),

    onSuccess: (_, variables) => {
      toast.success(TOAST.DAILY_CLOSING.CREATED);
      tracker.track(EVENTS.DAILY_CLOSING_CREATED, {
        totalSales: variables?.total_sales,
        cashSales:  variables?.cash_sales,
        cardSales:  variables?.card_sales,
        upiSales:   variables?.upi_sales,
        ...sessionCtx,
      });
      queryClient.invalidateQueries({ queryKey: ['daily-closing'] });
    },

    onError: (error, variables) => {
      toast.error(TOAST.DAILY_CLOSING.CREATE_FAILED);
      tracker.track(EVENTS.DAILY_CLOSING_FAILED, {
        error:      error?.message ?? 'unknown',
        totalSales: variables?.total_sales,
        ...sessionCtx,
      });
    },
  });
}
