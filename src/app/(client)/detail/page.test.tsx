import { describe, expect, it, vi } from 'vitest'

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}))

vi.mock('@/features/banners', () => ({
  DetailDialog: (props: { id: string; asModal?: boolean }) => <div data-props={JSON.stringify(props)} />,
}))

describe('상세 페이지', () => {
  it('id가 없으면 notFound를 호출한다', async () => {
    const { default: DetailPage } = await import('./page')
    await expect(DetailPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  })

  it('id가 있으면 DetailDialog를 페이지 모드(asModal=false)로 렌더한다', async () => {
    const { default: DetailPage } = await import('./page')
    const element = await DetailPage({
      searchParams: Promise.resolve({ id: 'banner-1' }),
    })

    expect((element as { props: { id: string; asModal: boolean } }).props).toEqual({
      id: 'banner-1',
      asModal: false,
    })
  })
})
