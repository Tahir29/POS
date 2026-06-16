import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { QUERY_KEYS } from "@/constants/queryKeys";
import { getSchemes } from "@/services/schemeService";
import APP_CONFIG from "@/constants/appConfig";

/**
 * Fetches all available loyalty/savings schemes.
 * Response shape: response.data.Entities[]
 * Stale time: STATIC (30 min) — schemes change infrequently.
 */

export function useScheme() {
    const { token } = useSelector((state) => state.auth);

    const query = useQuery({
        queryKey: QUERY_KEYS.SCHEMES.LIST(),
        queryFn: async() => {
            const response = await getSchemes();
            return response.data?.Entities ?? []
        },
        enabled: !!token,
        staleTime: APP_CONFIG.STALE_TIME.STATIC,
    });

    return {
        schemes: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
    }
}