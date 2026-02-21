import { useQuery } from '@tanstack/react-query'
import { fetchStatsOverview } from '@/features/stats/actions/fetch-stats-overview'
import type { StatsParams } from '@/features/stats/schemas/stats-schema'
import type { StatsOverviewResponse } from '@/features/stats/types/stats'

export type { StatsParams, StatsOverviewResponse }

// ─── React Query 키 팩토리 ─────────────────────────────────────────────────────

export const statsKeys = {
  overview: (params: StatsParams) => ['stats', 'overview', params] as const,
}

// ─── React Query 훅 ───────────────────────────────────────────────────────────

export function useStatsOverview(params: StatsParams = {}) {
  return useQuery({
    queryKey: statsKeys.overview(params),
    queryFn: () => fetchStatsOverview(params),
    staleTime: 60 * 1000,
  })
}
