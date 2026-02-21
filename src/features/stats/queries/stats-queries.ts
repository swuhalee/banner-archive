import { useQuery } from '@tanstack/react-query'

// ─── 타입 ──────────────────────────────────────────────────────────────────────

export type StatsParams = {
  from?: string
  to?: string
  region?: string
  subjectType?: string
  hashtag?: string
  limit?: number
}

export type StatsOverviewResponse = {
  summary: {
    totalBanners: number
    totalRegions: number
    totalSubjects: number
  }
  byRegion: Array<{ region: string; count: number }>
  bySubjectType: Array<{ subjectType: string; count: number }>
  topHashtags: Array<{ tag: string; count: number; ratio: number }>
  timeSeries: Array<{ bucket: string; count: number }>
}

// ─── API 함수 ──────────────────────────────────────────────────────────────────

export async function fetchStatsOverview(params: StatsParams = {}): Promise<StatsOverviewResponse> {
  const sp = new URLSearchParams()
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.region) sp.set('region', params.region)
  if (params.subjectType) sp.set('subjectType', params.subjectType)
  if (params.hashtag) sp.set('hashtag', params.hashtag)
  if (params.limit != null) sp.set('limit', String(params.limit))

  const res = await fetch(`/api/stats/overview?${sp}`)
  if (!res.ok) throw new Error('통계 데이터를 불러오지 못했습니다')
  return res.json()
}

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
