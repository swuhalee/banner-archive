import { describe, expect, it } from 'vitest'
import {
  bannerListParamsSchema,
  createBannerInputSchema,
  submitAppealInputSchema,
} from '@/features/banners/schemas/banner-schema'

describe('createBannerInputSchema', () => {
  it('optional 문자열과 hashtags를 정규화한다', () => {
    const parsed = createBannerInputSchema.parse({
      title: '  테스트 제목  ',
      hashtags: ['  정책 ', '', '교통  '],
      subjectType: '  ',
      regionText: '서울 강남구',
      firstSeenAt: '2026-02-20T00:00:00.000Z',
      lastSeenAt: '2026-02-21T00:00:00.000Z',
    })

    expect(parsed.title).toBe('테스트 제목')
    expect(parsed.hashtags).toEqual(['정책', '교통'])
    expect(parsed.subjectType).toBeUndefined()
  })

  it('firstSeenAt이 lastSeenAt보다 늦으면 거부한다', () => {
    const result = createBannerInputSchema.safeParse({
      regionText: '서울 강남구',
      firstSeenAt: '2026-02-22T00:00:00.000Z',
      lastSeenAt: '2026-02-21T00:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })
})

describe('bannerListParamsSchema', () => {
  it('기본 페이지네이션 값을 적용한다', () => {
    const parsed = bannerListParamsSchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(20)
  })

  it('범위를 벗어난 limit은 거부한다', () => {
    const result = bannerListParamsSchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })
})

describe('submitAppealInputSchema', () => {
  it('유효한 신고 입력을 허용한다', () => {
    const parsed = submitAppealInputSchema.parse({
      bannerId: 'banner-id-1',
      reasonType: 'privacy',
      reasonDetail: '  정보 노출  ',
    })

    expect(parsed.bannerId).toBe('banner-id-1')
    expect(parsed.reasonType).toBe('privacy')
    expect(parsed.reasonDetail).toBe('정보 노출')
  })

  it('유효하지 않은 신고 유형은 거부한다', () => {
    const result = submitAppealInputSchema.safeParse({
      bannerId: 'banner-id-1',
      reasonType: 'invalid',
    })

    expect(result.success).toBe(false)
  })
})
