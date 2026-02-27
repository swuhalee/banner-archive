import { beforeEach, describe, expect, it, vi } from 'vitest'

const { convertToWebPMock } = vi.hoisted(() => ({
  convertToWebPMock: vi.fn(),
}))

vi.mock('./convert-to-webp', () => ({
  convertToWebP: convertToWebPMock,
}))

class MockXMLHttpRequest {
  static statusToReturn = 200
  upload = { onprogress: null as null | ((event: ProgressEvent) => void) }
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  status = 0
  open() {}
  setRequestHeader() {}
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent)
    this.status = MockXMLHttpRequest.statusToReturn
    this.onload?.()
  }
}

describe('uploadSourceForAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    convertToWebPMock.mockResolvedValue(new File([new Uint8Array(999)], 'a.webp', { type: 'image/webp' }))
    MockXMLHttpRequest.statusToReturn = 200
    vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest as unknown as typeof XMLHttpRequest)
  })

  it('signed upload URL 발급 실패 시 에러를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: '업로드 URL 발급 실패' }),
      }),
    )

    const { uploadSourceForAnalysis } = await import('./source-upload')

    await expect(
      uploadSourceForAnalysis(new File(['x'], 'a.png', { type: 'image/png' })),
    ).rejects.toThrow('업로드 URL 발급 실패')
  })

  it('init 요청에 contentLength를 함께 전송한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bucket: 'bucket',
        path: 'sources/raw/a.png',
        token: 'tok',
        signedUrl: 'https://example.com/upload',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { uploadSourceForAnalysis } = await import('./source-upload')
    const file = new File([new Uint8Array(1234)], 'a.avif', { type: 'image/avif' })
    await uploadSourceForAnalysis(file)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads/source-upload-url',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ contentType: 'image/webp', contentLength: 999 }),
      }),
    )
  })

  it('signedUrl 업로드 성공 시 sourcePath를 반환하고 progress를 전달한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bucket: 'bucket',
          path: 'sources/raw/a.png',
          token: 'tok',
          signedUrl: 'https://example.com/upload',
        }),
      }),
    )
    const onProgress = vi.fn()

    const { uploadSourceForAnalysis } = await import('./source-upload')
    const result = await uploadSourceForAnalysis(
      new File(['x'], 'a.tiff', { type: 'image/tiff' }),
      onProgress,
    )

    expect(onProgress).toHaveBeenCalledWith(50)
    expect(onProgress).toHaveBeenCalledWith(100)
    expect(result).toEqual({ sourcePath: 'sources/raw/a.png' })
  })

  it('변환 결과가 20MB를 초과하면 업로드를 중단한다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    convertToWebPMock.mockResolvedValue(
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'too-large.webp', { type: 'image/webp' }),
    )

    const { uploadSourceForAnalysis } = await import('./source-upload')
    await expect(
      uploadSourceForAnalysis(new File(['x'], 'a.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('변환 후에도 이미지 크기가 20MB를 초과합니다. 더 작은 이미지를 사용해 주세요.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
