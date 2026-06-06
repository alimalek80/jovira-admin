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
  getAdminTourPackage,
  listAdminCurrencyOptions,
  listAdminExcursionOptions,
  listAdminFlightOptions,
  listAdminHotelOptions,
  listAdminTransferOptions,
  listAdminTourPackages,
  updateTourPackage,
  type AdminTourPackage,
  type ComponentOption,
  type CurrencyOption,
  type TourPackagePayload,
} from "@/lib/api/tour-packages";

const tourPackageKeys = {
  all: ["tour-packages"] as const,
  adminList: () => [...tourPackageKeys.all, "admin-list"] as const,
  adminDetail: (id: number) => [...tourPackageKeys.all, "admin-detail", id] as const,
  options: {
    flights: () => [...tourPackageKeys.all, "options", "flights"] as const,
    hotels: () => [...tourPackageKeys.all, "options", "hotels"] as const,
    transfers: () => [...tourPackageKeys.all, "options", "transfers"] as const,
    excursions: () => [...tourPackageKeys.all, "options", "excursions"] as const,
    currencies: () => [...tourPackageKeys.all, "options", "currencies"] as const,
  },
};

export { tourPackageKeys };

export function useAdminTourPackages(
  options?: Omit<UseQueryOptions<AdminTourPackage[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: tourPackageKeys.adminList(),
    queryFn: listAdminTourPackages,
    ...options,
  });
}

export function useAdminTourPackageDetail(
  id: number | null,
  options?: Omit<UseQueryOptions<AdminTourPackage>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: id ? tourPackageKeys.adminDetail(id) : [...tourPackageKeys.all, "admin-detail", "none"],
    queryFn: async () => {
      if (!id) {
        throw new Error("Tour package id is required.");
      }

      return getAdminTourPackage(id);
    },
    enabled: typeof id === "number" && id > 0,
    ...options,
  });
}

export function useCreateTourPackage(
  options?: UseMutationOptions<AdminTourPackage, unknown, TourPackagePayload>
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
  options?: UseMutationOptions<AdminTourPackage, unknown, { id: number; payload: Partial<TourPackagePayload> }>
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

export function useTourPackageFormOptions() {
  const flightsQuery = useQuery<ComponentOption[]>({
    queryKey: tourPackageKeys.options.flights(),
    queryFn: listAdminFlightOptions,
  });

  const hotelsQuery = useQuery<ComponentOption[]>({
    queryKey: tourPackageKeys.options.hotels(),
    queryFn: listAdminHotelOptions,
  });

  const transfersQuery = useQuery<ComponentOption[]>({
    queryKey: tourPackageKeys.options.transfers(),
    queryFn: listAdminTransferOptions,
  });

  const excursionsQuery = useQuery<ComponentOption[]>({
    queryKey: tourPackageKeys.options.excursions(),
    queryFn: listAdminExcursionOptions,
  });

  const currenciesQuery = useQuery<CurrencyOption[]>({
    queryKey: tourPackageKeys.options.currencies(),
    queryFn: listAdminCurrencyOptions,
  });

  return {
    flightsQuery,
    hotelsQuery,
    transfersQuery,
    excursionsQuery,
    currenciesQuery,
  };
}
