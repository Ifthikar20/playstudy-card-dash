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
  return useQuery<AppData, Error>({
    queryKey: ['appData'],
    queryFn: fetchAppData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });
};
