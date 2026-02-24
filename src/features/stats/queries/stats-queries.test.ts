import { beforeEach, describe, expect, it, vi } from 'vitest'

const useQueryMock = vi.fn()
const fetchStatsOverviewMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/features/stats/actions/fetch-stats-overview', () => ({
  fetchStatsOverview: fetchStatsOverviewMock,
}))

describe('statsKeys', () => {
  it('overview 키를 생성한다', async () => {
    const { statsKeys } = await import('./stats-queries')
    expect(statsKeys.overview({ region: '서울' })).toEqual([
      'stats',
      'overview',
      { region: '서울' },
    ])
  })
})

describe('useStatsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryMock.mockReturnValue({ data: undefined, isPending: true })
    fetchStatsOverviewMock.mockResolvedValue({ summary: { totalBanners: 0, totalRegions: 0, totalSubjects: 0 }, byRegion: [], bySubjectType: [], topHashtags: [], timeSeries: [] })
  })

  it('useQuery에 queryKey/queryFn/staleTime을 전달한다', async () => {
    const { useStatsOverview } = await import('./stats-queries')
    useStatsOverview({ region: '서울' })

    expect(useQueryMock).toHaveBeenCalledTimes(1)
    const options = useQueryMock.mock.calls[0][0]
    expect(options.queryKey).toEqual(['stats', 'overview', { region: '서울' }])
    expect(options.staleTime).toBe(60 * 1000)

    await options.queryFn()
    expect(fetchStatsOverviewMock).toHaveBeenCalledWith({ region: '서울' })
  })
})
