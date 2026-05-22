"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  createTourist,
  deleteTourist,
  getTourist,
  listTourists,
  updateTourist,
  type ApiScope,
  type Tourist,
  type TouristInput,
} from "@/lib/api/tourists";

const touristKeys = {
  all: ["tourists"] as const,
  lists: () => [...touristKeys.all, "list"] as const,
  list: (scope: ApiScope, reservationId?: number) => [...touristKeys.lists(), scope, reservationId ?? "all"] as const,
  detail: (scope: ApiScope, touristId: number) => [...touristKeys.all, "detail", scope, touristId] as const,
};

export { touristKeys };

export function useTourists(
  scope: ApiScope,
  reservationId?: number,
  options?: Omit<UseQueryOptions<Tourist[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: touristKeys.list(scope, reservationId),
    queryFn: () => listTourists(scope, { reservationId }),
    ...options,
  });
}

export function useTourist(
  scope: ApiScope,
  touristId: number,
  options?: Omit<UseQueryOptions<Tourist>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: touristKeys.detail(scope, touristId),
    queryFn: () => getTourist(scope, touristId),
    enabled: touristId > 0,
    ...options,
  });
}

export function useCreateTourist(
  scope: ApiScope,
  reservationId?: number,
  options?: UseMutationOptions<Tourist, unknown, TouristInput>
) {
  const queryClient = useQueryClient();
  const { onSuccess: externalOnSuccess, ...mutationOptions } = options ?? {};

  return useMutation({
    ...mutationOptions,
    mutationFn: (payload) => createTourist(scope, payload),
    onSuccess: async (createdTourist, ...args) => {
      if (reservationId) {
        queryClient.setQueryData<Tourist[]>(touristKeys.list(scope, reservationId), (previous) => {
          if (!previous) {
            return [createdTourist];
          }

          const exists = previous.some((tourist) => tourist.id === createdTourist.id);
          if (exists) {
            return previous;
          }

          return [createdTourist, ...previous];
        });
      }
      await externalOnSuccess?.(createdTourist, ...args);
    },
  });
}

export function useUpdateTourist(
  scope: ApiScope,
  reservationId?: number,
  options?: UseMutationOptions<Tourist, unknown, { touristId: number; payload: Partial<TouristInput> }>
) {
  const queryClient = useQueryClient();
  const { onSuccess: externalOnSuccess, ...mutationOptions } = options ?? {};

  return useMutation({
    ...mutationOptions,
    mutationFn: ({ touristId, payload }) => updateTourist(scope, touristId, payload),
    onSuccess: async (updatedTourist, ...args) => {
      if (reservationId) {
        queryClient.setQueryData<Tourist[]>(touristKeys.list(scope, reservationId), (previous) => {
          if (!previous || previous.length === 0) {
            return [updatedTourist];
          }

          const next = previous.map((tourist) =>
            tourist.id === updatedTourist.id ? updatedTourist : tourist
          );

          const exists = previous.some((tourist) => tourist.id === updatedTourist.id);
          return exists ? next : [updatedTourist, ...previous];
        });
      }

      queryClient.setQueryData<Tourist>(touristKeys.detail(scope, updatedTourist.id), updatedTourist);

      await queryClient.invalidateQueries({ queryKey: touristKeys.lists() });
      if (reservationId) {
        await queryClient.invalidateQueries({ queryKey: touristKeys.list(scope, reservationId) });
      }
      await externalOnSuccess?.(updatedTourist, ...args);
    },
  });
}

export function useDeleteTourist(
  scope: ApiScope,
  reservationId?: number,
  options?: UseMutationOptions<void, unknown, number>
) {
  const queryClient = useQueryClient();
  const { onSuccess: externalOnSuccess, ...mutationOptions } = options ?? {};

  return useMutation({
    ...mutationOptions,
    mutationFn: (touristId) => deleteTourist(scope, touristId),
    onSuccess: async (_, deletedTouristId, ...args) => {
      if (reservationId) {
        queryClient.setQueryData<Tourist[]>(touristKeys.list(scope, reservationId), (previous) => {
          if (!previous) {
            return [];
          }

          return previous.filter((tourist) => tourist.id !== deletedTouristId);
        });
      }

      queryClient.removeQueries({ queryKey: touristKeys.detail(scope, deletedTouristId) });

      await queryClient.invalidateQueries({ queryKey: touristKeys.lists() });
      if (reservationId) {
        await queryClient.invalidateQueries({ queryKey: touristKeys.list(scope, reservationId) });
      }
      await externalOnSuccess?.(_, deletedTouristId, ...args);
    },
  });
}
