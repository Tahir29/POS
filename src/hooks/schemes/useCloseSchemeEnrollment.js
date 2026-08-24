// Records a calculated closure benefit against a scheme enrollment — see
// closeSchemeEnrollment's header in schemeService.js for exactly what this
// does and does not write (benifit_amount only, scheme_status untouched
// pending confirmation of its enum meaning).

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { closeSchemeEnrollment } from '@/services/schemeService';
import TOAST from '@/constants/toastMessages';

export function useCloseSchemeEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: closeSchemeEnrollment,

    onSuccess: () => {
      toast.success(TOAST.SCHEMES.CLOSURE_RECORDED);
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
    },

    onError: () => {
      toast.error(TOAST.SCHEMES.CLOSURE_FAILED);
    },
  });
}
