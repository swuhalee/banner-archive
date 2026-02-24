import { describe, expect, it } from 'vitest'
import {
  MAX_UPLOAD_FILE_SIZE,
  analyzeBannerInputSchema,
  detectedBannerListSchema,
} from '@/features/uploads/schemas/upload-schema'

function createImageFile(type = 'image/jpeg', size = 16) {
  return new File([new Uint8Array(size)], 'banner.jpg', { type })
}

describe('analyzeBannerInputSchema', () => {
  it('유효한 입력을 파싱하고 optional subjectType을 정규화한다', () => {
    const parsed = analyzeBannerInputSchema.parse({
      image: createImageFile('image/png'),
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
      subjectType: '  ',
    })

    expect(parsed.image.type).toBe('image/png')
    expect(parsed.regionText).toBe('서울 강남구')
    expect(parsed.subjectType).toBeUndefined()
  })

  it('지원하지 않는 MIME 타입은 거부한다', () => {
    const result = analyzeBannerInputSchema.safeParse({
      image: createImageFile('image/gif'),
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })

  it('20MB를 초과하는 파일은 거부한다', () => {
    const tooLarge = createImageFile('image/jpeg', MAX_UPLOAD_FILE_SIZE + 1)
    const result = analyzeBannerInputSchema.safeParse({
      image: tooLarge,
      regionText: '서울 강남구',
      observedAt: '2026-02-23T00:00:00.000Z',
    })

    expect(result.success).toBe(false)
  })

  it('유효하지 않은 observedAt은 거부한다', () => {
    const result = analyzeBannerInputSchema.safeParse({
      image: createImageFile(),
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
