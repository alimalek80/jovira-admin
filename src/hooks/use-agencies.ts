"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  approveAgency,
  listAdminAgencies,
  updateAgency,
  type Agency,
  type AgencyUpdatePayload,
} from "@/lib/api/agencies";

const agencyKeys = {
  all: ["agencies"] as const,
  adminList: () => [...agencyKeys.all, "admin-list"] as const,
};

export { agencyKeys };

export function useAdminAgencies(options?: Omit<UseQueryOptions<Agency[]>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: agencyKeys.adminList(),
    queryFn: listAdminAgencies,
    ...options,
  });
}

export function useApproveAgency(options?: UseMutationOptions<void, unknown, number>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => approveAgency(id),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: agencyKeys.adminList() });
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateAgency(
  options?: UseMutationOptions<Agency, unknown, { id: number; payload: AgencyUpdatePayload }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) => updateAgency(id, payload),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: agencyKeys.adminList() });
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}