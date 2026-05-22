"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  createTourPackage,
  listAdminTourPackages,
  updateTourPackage,
  type TourPackagePayload,
  type TourPackageResponse,
} from "@/lib/api/tour-packages";

const tourPackageKeys = {
  all: ["tour-packages"] as const,
  adminList: () => [...tourPackageKeys.all, "admin-list"] as const,
};

export { tourPackageKeys };

export function useAdminTourPackages(
  options?: Omit<UseQueryOptions<TourPackageResponse[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: tourPackageKeys.adminList(),
    queryFn: listAdminTourPackages,
    ...options,
  });
}

export function useCreateTourPackage(
  options?: UseMutationOptions<TourPackageResponse, unknown, TourPackagePayload>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createTourPackage(payload),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: tourPackageKeys.adminList() });
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useUpdateTourPackage(
  options?: UseMutationOptions<TourPackageResponse, unknown, { id: number; payload: Partial<TourPackagePayload> }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) => updateTourPackage(id, payload),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: tourPackageKeys.adminList() });
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}
