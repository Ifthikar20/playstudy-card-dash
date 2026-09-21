import { useQuery } from "@tanstack/react-query";
import { fetchChild, fetchChildActivity, fetchChildren, parentalKeys } from "@/services/parental";

/**
 * Learners this account follows.
 *
 * Note the query keys come from parentalKeys, never ['appData'] — see the
 * header of src/services/parental.ts for why that separation is load-bearing.
 */
export function useChildren() {
  return useQuery({
    queryKey: parentalKeys.children(),
    queryFn: fetchChildren,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useChild(childId: string | undefined) {
  return useQuery({
    queryKey: parentalKeys.child(childId ?? ""),
    queryFn: () => fetchChild(childId as string),
    enabled: Boolean(childId),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useChildActivity(childId: string | undefined, days = 182) {
  return useQuery({
    queryKey: parentalKeys.childActivity(childId ?? "", days),
    queryFn: () => fetchChildActivity(childId as string, days),
    enabled: Boolean(childId),
    staleTime: 60_000,
    retry: 1,
  });
}
