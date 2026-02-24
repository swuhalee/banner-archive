import { describe, expect, it, vi } from 'vitest'

const { notFoundMock, sanitizeReturnPathMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  sanitizeReturnPathMock: vi.fn(() => '/archive'),
}))

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}))

vi.mock('@/lib/return-path', () => ({
  sanitizeReturnPath: sanitizeReturnPathMock,
}))

vi.mock('@/features/banners', () => ({
  DetailDialog: (props: { id: string; closeHref?: string }) => <div data-props={JSON.stringify(props)} />,
}))

describe('상세 모달 페이지', () => {
  it('id가 없으면 notFound를 호출한다', async () => {
    const { default: DetailModalPage } = await import('./page')
    await expect(
      DetailModalPage({ searchParams: Promise.resolve({ from: '/archive' }) }),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('id와 from을 기반으로 DetailDialog props를 전달한다', async () => {
    const { default: DetailModalPage } = await import('./page')
    const element = await DetailModalPage({
      searchParams: Promise.resolve({ id: 'banner-1', from: '/stats' }),
    })

    expect(sanitizeReturnPathMock).toHaveBeenCalledWith('/stats', '/')
    expect((element as { props: { id: string; closeHref: string } }).props).toEqual({
      id: 'banner-1',
      closeHref: '/archive',
    })
  })
})
