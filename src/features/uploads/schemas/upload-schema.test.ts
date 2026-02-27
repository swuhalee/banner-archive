import { describe, expect, it } from 'vitest'
import {
  analyzeBannerInputSchema,
  detectedBannerListSchema,
} from '@/features/uploads/schemas/upload-schema'

describe('analyzeBannerInputSchema', () => {
  it('유효한 입력을 파싱하고 optional subjectType을 정규화한다', () => {
    const parsed = analyzeBannerInputSchema.parse({
      sourcePath: 'sources/raw/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp',
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
      subjectType: '  ',
    })

    expect(parsed.sourcePath).toContain('sources/raw/')
    expect(parsed.regionText).toBe('서울 강남구')
    expect(parsed.subjectType).toBeUndefined()
  })

  it('sourcePath가 webp 확장자가 아니면 거부한다', () => {
    const result = analyzeBannerInputSchema.safeParse({
      sourcePath: 'sources/raw/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })

  it('sourcePath 형식이 잘못되면 거부한다', () => {
    const result = analyzeBannerInputSchema.safeParse({
      sourcePath: 'https://malicious.example.com/file.png',
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })

  it('유효하지 않은 observedAt은 거부한다', () => {
    const result = analyzeBannerInputSchema.safeParse({
      sourcePath: 'sources/raw/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp',
      regionText: '서울 강남구',
      observedAt: 'not-a-date',
    })

    expect(result.success).toBe(false)
  })
})

describe('detectedBannerListSchema', () => {
  it('목록 필드가 없으면 기본값 빈 배열을 적용한다', () => {
    const parsed = detectedBannerListSchema.parse({})
    expect(parsed.banners).toEqual([])
    expect(parsed.privacyRegions).toEqual([])
  })

  it('유효하지 않은 privacy region type은 거부한다', () => {
    const result = detectedBannerListSchema.safeParse({
      banners: [],
      privacyRegions: [{ type: 'other', bbox: { x: 0, y: 0, width: 1, height: 1 } }],
    })

    expect(result.success).toBe(false)
  })
})
