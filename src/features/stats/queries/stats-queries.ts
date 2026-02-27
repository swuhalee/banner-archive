import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchStatsOverview } from '@/features/stats/actions/fetch-stats-overview'
import type { StatsParams } from '@/features/stats/schemas/stats-schema'
import type { StatsOverviewResponse } from '@/features/stats/types/stats'

export type { StatsParams, StatsOverviewResponse }

export const statsKeys = {
  overview: (params: StatsParams) => ['stats', 'overview', params] as const,
}

export const statsOverviewQueryOptions = (params: StatsParams = {}) =>
  queryOptions({
    queryKey: statsKeys.overview(params),
    queryFn: () => fetchStatsOverview(params),
    staleTime: 60 * 1000,
  })

export function useStatsOverview(params: StatsParams = {}) {
  return useQuery(statsOverviewQueryOptions(params))
}
