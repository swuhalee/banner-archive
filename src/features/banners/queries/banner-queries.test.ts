import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bannerKeys, commitBannerWithProgress } from '@/features/banners/queries/banner-queries'

describe('bannerKeys', () => {
  it('쿼리 키를 일관된 형태로 생성한다', () => {
    expect(bannerKeys.all).toEqual(['banners'])
    expect(bannerKeys.lists()).toEqual(['banners', 'list'])
    expect(bannerKeys.list({ page: 2 })).toEqual(['banners', 'list', { page: 2 }])
    expect(bannerKeys.detail('id-1')).toEqual(['banners', 'detail', 'id-1'])
  })
})

describe('commitBannerWithProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('SSE 이벤트를 파싱해 진행률과 완료 데이터를 반환한다', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"progress":25}\n'))
        controller.enqueue(
          encoder.encode('\ndata: {"progress":100,"done":true,"data":{"savedBannerIds":["b1"],"rejectedDuplicates":[],"savedCount":1,"rejectedCount":0}}\n\n'),
        )
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, { status: 200 }),
    )

    const onProgress = vi.fn()
    const result = await commitBannerWithProgress(
      {
        uploadSourceId: 'up-1',
        selectedCandidates: [
          {
            tempId: 'tmp-1',
            title: '제목',
            hashtags: ['정책'],
            subjectType: '정당',
            bbox: { x: 0, y: 0, width: 1, height: 1 },
            confidence: 0.9,
          },
        ],
      },
      onProgress,
    )

    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onProgress).toHaveBeenCalledWith(100)
    expect(result).toEqual({
      savedBannerIds: ['b1'],
      rejectedDuplicates: [],
      savedCount: 1,
      rejectedCount: 0,
    })
  })

  it('SSE 에러 이벤트를 받으면 예외를 던진다', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"error":"저장 실패"}\n\n'))
        controller.close()
      },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(stream, { status: 200 }))

    await expect(
      commitBannerWithProgress(
        { uploadSourceId: 'up-1', selectedCandidates: [] },
        () => undefined,
      ),
    ).rejects.toThrow('저장 실패')
  })
})
