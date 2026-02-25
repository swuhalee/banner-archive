import { describe, expect, it, vi } from 'vitest'

const { sanitizeReturnPathMock } = vi.hoisted(() => ({
  sanitizeReturnPathMock: vi.fn(() => '/'),
}))

vi.mock('@/lib/return-path', () => ({
  sanitizeReturnPath: sanitizeReturnPathMock,
}))

vi.mock('@/features/uploads', () => ({
  UploadDialog: (props: { closeHref?: string }) => <div data-props={JSON.stringify(props)} />,
}))

describe('업로드 모달 페이지', () => {
  it('maxDuration을 60초로 설정한다', async () => {
    const mod = await import('./page')
    expect(mod.maxDuration).toBe(60)
  })

  it('from을 sanitize하여 UploadDialog closeHref로 전달한다', async () => {
    const { default: UploadModalPage } = await import('./page')
    const element = await UploadModalPage({
      searchParams: Promise.resolve({ from: '/archive' }),
    })

    expect(sanitizeReturnPathMock).toHaveBeenCalledWith('/archive', '/')
    expect((element as { props: { closeHref: string } }).props).toEqual({
      closeHref: '/',
    })
  })
})
