"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getAdminHeroSection,
  updateAdminHeroSection,
  type HeroSectionUpdateInput,
  type HeroSectionResponse,
} from "@/lib/api/public-site";

const publicSiteSettingsKeys = {
  all: ["public-site-settings"] as const,
  hero: () => [...publicSiteSettingsKeys.all, "hero"] as const,
};

export { publicSiteSettingsKeys };

export function useAdminHeroSection(
  options?: Omit<UseQueryOptions<HeroSectionResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: publicSiteSettingsKeys.hero(),
    queryFn: getAdminHeroSection,
    ...options,
  });
}

export function useUpdateAdminHeroSection(
  options?: UseMutationOptions<HeroSectionResponse, unknown, HeroSectionUpdateInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => updateAdminHeroSection(payload),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: publicSiteSettingsKeys.hero() });
      await options?.onSuccess?.(...args);
    },
    ...options,
  });
}
