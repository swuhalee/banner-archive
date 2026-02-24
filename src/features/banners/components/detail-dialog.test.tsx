/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DetailDialog from '@/features/banners/components/detail-dialog'

const { useBannerMock } = vi.hoisted(() => ({
  useBannerMock: vi.fn(),
}))

vi.mock('@/features/banners/queries/banner-queries', () => ({
  useBanner: useBannerMock,
}))

vi.mock('@/components/ui/route-dialog', () => ({
  default: ({ children }: { children: unknown }) => <div data-testid="route-dialog">{children}</div>,
}))

vi.mock('@/features/banners/components/report-dialog', () => ({
  default: ({ open }: { open: boolean }) => <div data-testid="report-state">{open ? 'open' : 'closed'}</div>,
}))

describe('DetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('에러 상태에서 안내 메시지를 보여준다', () => {
    useBannerMock.mockReturnValue({ data: undefined, isPending: false, isError: true })
    render(<DetailDialog id="banner-1" />)

    expect(screen.getByText('배너를 불러오지 못했습니다.')).toBeInTheDocument()
  })

  it('데이터가 있으면 상세 정보를 렌더하고 신고 모달을 열 수 있다', () => {
    useBannerMock.mockReturnValue({
      data: {
        id: 'banner-1',
        title: '테스트',
        hashtags: ['정책'],
        subjectType: '정당',
        regionText: '서울 강남구',
        firstSeenAt: '2026-02-20T00:00:00.000Z',
        lastSeenAt: '2026-02-21T00:00:00.000Z',
        observedCount: 3,
        status: 'active',
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-02-21T00:00:00.000Z',
        images: [{ maskedImageUrl: '/img.webp' }],
      },
      isPending: false,
      isError: false,
    })

    render(<DetailDialog id="banner-1" asModal={false} />)

    expect(screen.getByText('서울 강남구')).toBeInTheDocument()
    expect(screen.getByText('#정책')).toBeInTheDocument()
    expect(screen.getByTestId('report-state')).toHaveTextContent('closed')

    fireEvent.click(screen.getByRole('button', { name: '더보기' }))
    fireEvent.click(screen.getByRole('button', { name: '신고' }))
    expect(screen.getByTestId('report-state')).toHaveTextContent('open')
  })
})
