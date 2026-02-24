import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const uploadMock = vi.fn()
const fromStorageMock = vi.fn()
const createAdminClientMock = vi.fn()
const returningMock = vi.fn()
const valuesMock = vi.fn()
const insertMock = vi.fn()
const modelGenerateContentMock = vi.fn()
const getGenerativeModelMock = vi.fn()

vi.mock('@/server/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/server/db', () => ({
  db: {
    insert: insertMock,
  },
}))

vi.mock('@/server/db/schema', () => ({
  uploadSources: {},
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class GoogleGenerativeAI {
    constructor(_apiKey: string) {}

    getGenerativeModel = getGenerativeModelMock
  },
}))

describe('analyzeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.GEMINI_API_KEY = 'test-key'
    process.env.SUPABASE_STORAGE_BUCKET = 'bucket'
    process.env.ENABLE_ANALYZE_SECOND_PASS = 'false'

    uploadMock.mockResolvedValue({ error: null })
    fromStorageMock.mockReturnValue({ upload: uploadMock })
    createAdminClientMock.mockReturnValue({
      storage: {
        from: fromStorageMock,
      },
    })

    returningMock.mockResolvedValue([{ id: 'upload-source-1' }])
    valuesMock.mockReturnValue({ returning: returningMock })
    insertMock.mockReturnValue({ values: valuesMock })

    modelGenerateContentMock.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            banners: [
              {
                tempId: 'banner_0',
                title: '테스트 현수막',
                hashtags: ['서울', '정책'],
                subjectType: '정당',
                bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                confidence: 0.93,
              },
            ],
            privacyRegions: [
              {
                type: 'face',
                bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
              },
            ],
          }),
      },
    })
    getGenerativeModelMock.mockReturnValue({
      generateContent: modelGenerateContentMock,
    })
  })

  it('분석 결과를 저장하고 uploadSourceId/candidates를 반환한다', async () => {
    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer()

    const formData = new FormData()
    formData.append('image', new File([image], 'test.png', { type: 'image/png' }))
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')
    formData.append('subjectType', '정당')

    const { analyzeBanner } = await import('./analyze-banner')
    const result = await analyzeBanner(formData)

    expect(createAdminClientMock).toHaveBeenCalledTimes(1)
    expect(uploadMock).toHaveBeenCalledTimes(1)
    expect(result.uploadSourceId).toBe('upload-source-1')
    expect(result.candidates).toHaveLength(1)
    expect(result.privacyRegions).toHaveLength(1)
  })

  it('Gemini 429 에러를 사용자 친화 메시지로 변환한다', async () => {
    modelGenerateContentMock.mockRejectedValueOnce(
      new Error('429 Too Many Requests, retry in 5s'),
    )

    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer()

    const formData = new FormData()
    formData.append('image', new File([image], 'test.png', { type: 'image/png' }))
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')
    formData.append('subjectType', '')

    const { analyzeBanner } = await import('./analyze-banner')

    await expect(analyzeBanner(formData)).rejects.toThrow(
      'AI 분석 요청 한도를 초과했습니다 (Gemini 429).',
    )
  })
})
