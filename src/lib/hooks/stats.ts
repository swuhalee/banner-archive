import { useQuery } from '@tanstack/react-query'
import { fetchStatsOverview, type StatsParams } from '@/lib/api/stats'

export const statsKeys = {
  overview: (params: StatsParams) => ['stats', 'overview', params] as const,
}

export function useStatsOverview(params: StatsParams = {}) {
  return useQuery({
    queryKey: statsKeys.overview(params),
    queryFn: () => fetchStatsOverview(params),
    staleTime: 60 * 1000,
  })
}
