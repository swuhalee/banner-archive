import { beforeEach, describe, expect, it, vi } from 'vitest'

const findManyMock = vi.fn()
const whereMock = vi.fn()
const fromMock = vi.fn()
const selectMock = vi.fn()
const resolveStorageUrlMock = vi.fn((path: string | null | undefined) =>
  path ? `resolved:${path}` : null,
)

vi.mock('@/server/db', () => ({
  db: {
    query: {
      banners: {
        findMany: findManyMock,
      },
    },
    select: selectMock,
  },
}))

vi.mock('@/server/lib/supabase/storage', () => ({
  resolveStorageUrl: resolveStorageUrlMock,
}))

vi.mock('@/server/db/schema', () => ({
  banners: {
    status: 'status',
    title: 'title',
    hashtags: 'hashtags',
    firstSeenAt: 'firstSeenAt',
    regionText: 'regionText',
    subjectType: 'subjectType',
  },
}))

describe('fetchBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    whereMock.mockResolvedValue([{ total: 2 }])
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })
  })

  it('배너 목록을 조회하고 날짜/이미지 URL을 변환해 반환한다', async () => {
    const now = new Date('2026-02-23T00:00:00.000Z')

    findManyMock.mockResolvedValue([
      {
        id: 'banner-1',
        title: '테스트',
        hashtags: ['정책'],
        subjectType: '정당',
        regionText: '서울 강남구',
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
        status: 'active',
        observedCount: 1,
        images: [
          {
            id: 'img-1',
            bannerId: 'banner-1',
            maskedImageUrl: 'masked.webp',
            originalImageUrl: 'original.webp',
            maskingStatus: 'success',
            maskingMetadata: null,
            phash: null,
            createdAt: now,
          },
          {
            id: 'img-2',
            bannerId: 'banner-1',
            maskedImageUrl: null,
            originalImageUrl: null,
            maskingStatus: 'success',
            maskingMetadata: null,
            phash: null,
            createdAt: now,
          },
        ],
      },
    ])

    const { fetchBanners } = await import('./fetch-banners')
    const result = await fetchBanners({ page: 1, limit: 20 })

    expect(findManyMock).toHaveBeenCalledTimes(1)
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].images).toHaveLength(1)
    expect(result.data[0].images?.[0].maskedImageUrl).toBe('resolved:masked.webp')
    expect(result.data[0].images?.[0].originalImageUrl).toBe('resolved:original.webp')
    expect(result.data[0].firstSeenAt).toBe(now.toISOString())
  })

  it('기본 페이지네이션 값을 적용한다', async () => {
    findManyMock.mockResolvedValue([])

    const { fetchBanners } = await import('./fetch-banners')
    const result = await fetchBanners()

    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
  })
})
