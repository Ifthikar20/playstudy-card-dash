/**
 * React Query hook for fetching and managing application data
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAppData, AppData } from '@/services/api';

/**
 * Custom hook to fetch all application data in a single API call
 * Uses React Query for caching and automatic refetching
 */
export const useAppData = () => {
  const query = useQuery<AppData, Error>({
    queryKey: ['appData'],
    queryFn: async () => {
      console.log('[useAppData] Starting fetchAppData...');
      try {
        const result = await fetchAppData();
        console.log('[useAppData] ✅ fetchAppData completed');
        return result;
      } catch (error) {
        console.error('[useAppData] ❌ fetchAppData failed:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1, // Reduced from 2 to avoid long delays
    retryDelay: 1000, // 1 second between retries
  });

  console.log('[useAppData] Query state:', {
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error?.message
  });

  return query;
};
