import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'

const infoMock = vi.fn()
const downloadMock = vi.fn()
const uploadMock = vi.fn()
const removeMock = vi.fn()
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
    constructor() {}

    getGenerativeModel = getGenerativeModelMock
  },
}))

describe('analyzeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.GEMINI_API_KEY = 'test-key'
    process.env.SUPABASE_STORAGE_BUCKET = 'bucket'
    process.env.ENABLE_ANALYZE_SECOND_PASS = 'false'

    infoMock.mockResolvedValue({ data: { size: 1000 }, error: null })
    downloadMock.mockResolvedValue({ data: new Blob(), error: null })
    uploadMock.mockResolvedValue({ error: null })
    removeMock.mockResolvedValue({ error: null })
    fromStorageMock.mockReturnValue({
      info: infoMock,
      download: downloadMock,
      upload: uploadMock,
      remove: removeMock,
    })
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
    downloadMock.mockResolvedValue({ data: new Blob([image], { type: 'image/png' }), error: null })

    const formData = new FormData()
    formData.append('sourcePath', 'sources/raw/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png')
    formData.append('sourceContentType', 'image/png')
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')
    formData.append('subjectType', '정당')

    const { analyzeBanner } = await import('./analyze-banner')
    const result = await analyzeBanner(formData)

    expect(createAdminClientMock).toHaveBeenCalledTimes(1)
    expect(downloadMock).toHaveBeenCalledTimes(1)
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
    downloadMock.mockResolvedValue({ data: new Blob([image], { type: 'image/png' }), error: null })

    const formData = new FormData()
    formData.append('sourcePath', 'sources/raw/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png')
    formData.append('sourceContentType', 'image/png')
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')
    formData.append('subjectType', '')

    const { analyzeBanner } = await import('./analyze-banner')

    await expect(analyzeBanner(formData)).rejects.toThrow(
      'AI 분석 요청 한도를 초과했습니다 (Gemini 429).',
    )
  })

  it('sourceContentType이 원본 형식과 다르면 거부한다', async () => {
    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer()
    downloadMock.mockResolvedValue({ data: new Blob([image], { type: 'image/png' }), error: null })

    const formData = new FormData()
    formData.append('sourcePath', 'sources/raw/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png')
    formData.append('sourceContentType', 'image/jpeg')
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')
    formData.append('subjectType', '정당')

    const { analyzeBanner } = await import('./analyze-banner')
    await expect(analyzeBanner(formData)).rejects.toThrow('업로드 파일 형식 검증에 실패했습니다')
  })

  it('Gemini가 최상위 배열로 배너 목록을 반환해도 정상 처리한다', async () => {
    modelGenerateContentMock.mockResolvedValueOnce({
      response: {
        text: () =>
          JSON.stringify([
            {
              tempId: 'banner_0',
              title: '배열 응답 테스트',
              hashtags: ['서울'],
              subjectType: '기타',
              bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
              confidence: 0.9,
            },
          ]),
      },
    })

    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .png()
      .toBuffer()
    downloadMock.mockResolvedValue({ data: new Blob([image], { type: 'image/png' }), error: null })

    const formData = new FormData()
    formData.append('sourcePath', 'sources/raw/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png')
    formData.append('sourceContentType', 'image/png')
    formData.append('regionText', '서울 강남구')
    formData.append('observedAt', '2026-02-23T00:00:00.000Z')

    const { analyzeBanner } = await import('./analyze-banner')
    const result = await analyzeBanner(formData)

    expect(result.candidates).toHaveLength(1)
    expect(result.privacyRegions).toHaveLength(0)
  })
})
