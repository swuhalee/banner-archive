import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  analyzeBanner,
  commitBanner,
  fetchBanner,
  fetchBanners,
  uploadBanner,
  type BannerListParams,
} from '@/lib/api/banners'

export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => ['banners', 'list'] as const,
  list: (params: BannerListParams) => ['banners', 'list', params] as const,
  detail: (id: string) => ['banners', 'detail', id] as const,
}

export function useBanners(params: BannerListParams = {}) {
  return useQuery({
    queryKey: bannerKeys.list(params),
    queryFn: () => fetchBanners(params),
    staleTime: 30 * 1000,
  })
}

export function useBanner(id: string) {
  return useQuery({
    queryKey: bannerKeys.detail(id),
    queryFn: () => fetchBanner(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  })
}

export function useUploadBanner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
    },
  })
}

export function useAnalyzeBanner() {
  return useMutation({ mutationFn: analyzeBanner })
}

export function useCommitBanner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: commitBanner,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() })
    },
  })
}
