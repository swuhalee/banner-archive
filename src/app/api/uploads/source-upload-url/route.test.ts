import { describe, expect, it, vi } from 'vitest'

const createSignedUploadUrlMock = vi.fn()
const fromMock = vi.fn(() => ({ createSignedUploadUrl: createSignedUploadUrlMock }))
const createAdminClientMock = vi.fn(() => ({
  storage: { from: fromMock },
}))

vi.mock('@/server/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

describe('POST /api/uploads/source-upload-url', () => {
  it('JSON 본문 파싱에 실패하면 400을 반환한다', async () => {
    const { POST } = await import('./route')
    const req = {
      json: async () => {
        throw new Error('bad json')
      },
    } as unknown as Request

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('지원하지 않는 contentType이면 400을 반환한다', async () => {
    const { POST } = await import('./route')
    const req = {
      json: async () => ({ contentType: 'image/heic', contentLength: 100 }),
    } as unknown as Request

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('contentLength가 없으면 400을 반환한다', async () => {
    const { POST } = await import('./route')
    const req = {
      json: async () => ({ contentType: 'image/webp' }),
    } as unknown as Request

    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('정상 요청이면 업로드 토큰과 경로를 반환한다', async () => {
    createSignedUploadUrlMock.mockResolvedValue({
      data: { token: 'tok', signedUrl: 'https://example.com/upload' },
      error: null,
    })

    const { POST } = await import('./route')
    const req = {
      json: async () => ({ contentType: 'image/webp', contentLength: 1024 }),
    } as unknown as Request

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalled()
    expect(createSignedUploadUrlMock).toHaveBeenCalled()
    expect(body.token).toBe('tok')
    expect(typeof body.path).toBe('string')
  })
})
