import { beforeEach, describe, expect, it, vi } from 'vitest'

const selectMock = vi.fn()
const executeMock = vi.fn()

function createThenable<T>(result: T) {
  return {
    from() {
      return this
    },
    where() {
      return this
    },
    groupBy() {
      return this
    },
    orderBy() {
      return this
    },
    limit() {
      return this
    },
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }
}

vi.mock('@/server/db', () => ({
  db: {
    select: selectMock,
    execute: executeMock,
  },
}))

vi.mock('@/server/db/schema', () => ({
  banners: {
    status: 'status',
    firstSeenAt: 'firstSeenAt',
    regionText: 'regionText',
    subjectType: 'subjectType',
    hashtags: 'hashtags',
  },
}))

describe('fetchStatsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('요약/그룹/해시태그/시계열 결과를 매핑해 반환한다', async () => {
    selectMock
      .mockReturnValueOnce(
        createThenable([{ totalBanners: 4, totalRegions: 2, totalSubjects: 2 }]),
      )
      .mockReturnValueOnce(
        createThenable([
          { region: '서울 강남구', count: 3 },
          { region: '서울 서초구', count: 1 },
        ]),
      )
      .mockReturnValueOnce(
        createThenable([
          { subjectType: '정당', count: 3 },
          { subjectType: '미분류', count: 1 },
        ]),
      )

    executeMock
      .mockResolvedValueOnce([
        { tag: '교통', count: 2 },
        { tag: '정책', count: 1 },
      ])
      .mockResolvedValueOnce([
        { bucket: '2026-02-20', count: 2 },
        { bucket: '2026-02-21', count: 2 },
      ])

    const { fetchStatsOverview } = await import('./fetch-stats-overview')
    const result = await fetchStatsOverview({ region: '서울', limit: 10 })

    expect(result.summary).toEqual({
      totalBanners: 4,
      totalRegions: 2,
      totalSubjects: 2,
    })
    expect(result.byRegion).toHaveLength(2)
    expect(result.bySubjectType).toHaveLength(2)
    expect(result.topHashtags).toEqual([
      { tag: '교통', count: 2, ratio: 0.5 },
      { tag: '정책', count: 1, ratio: 0.25 },
    ])
    expect(result.timeSeries).toEqual([
      { bucket: '2026-02-20', count: 2 },
      { bucket: '2026-02-21', count: 2 },
    ])
  })

  it('총 건수가 0일 때 해시태그 ratio를 0으로 반환한다', async () => {
    selectMock
      .mockReturnValueOnce(
        createThenable([{ totalBanners: 0, totalRegions: 0, totalSubjects: 0 }]),
      )
      .mockReturnValueOnce(createThenable([]))
      .mockReturnValueOnce(createThenable([]))

    executeMock
      .mockResolvedValueOnce([{ tag: '교통', count: 3 }])
      .mockResolvedValueOnce([])

    const { fetchStatsOverview } = await import('./fetch-stats-overview')
    const result = await fetchStatsOverview({})

    expect(result.topHashtags).toEqual([{ tag: '교통', count: 3, ratio: 0 }])
  })
})
