/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportDialog from '@/features/banners/components/report-dialog'

const { submitAppealMock } = vi.hoisted(() => ({
  submitAppealMock: vi.fn(),
}))

vi.mock('@/features/banners/queries/appeals-queries', () => ({
  submitAppeal: submitAppealMock,
}))

vi.mock('@headlessui/react', () => ({
  Dialog: ({
    open,
    children,
    className,
  }: {
    open: boolean
    children: unknown
    className?: string
  }) => (open ? <div className={className}>{children}</div> : null),
  DialogPanel: ({ children, ...rest }: { children: unknown }) => <div {...rest}>{children}</div>,
}))

describe('ReportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAppealMock.mockResolvedValue({ id: 'appeal-1' })
  })

  it('신고 유형을 선택하지 않으면 검증 에러를 보여준다', async () => {
    render(<ReportDialog open onClose={() => undefined} detailId="banner-1" />)

    fireEvent.click(screen.getByRole('button', { name: '신고' }))
    expect(await screen.findByText('신고 유형을 선택해주세요')).toBeInTheDocument()
    expect(submitAppealMock).not.toHaveBeenCalled()
  })

  it('정상 제출 시 성공 화면으로 전환한다', async () => {
    render(<ReportDialog open onClose={() => undefined} detailId="banner-1" />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'privacy' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '세부 사유' } })
    fireEvent.click(screen.getByRole('button', { name: '신고' }))

    await waitFor(() => {
      expect(submitAppealMock).toHaveBeenCalledWith({
        bannerId: 'banner-1',
        reasonType: 'privacy',
        reasonDetail: '세부 사유',
      })
    })
    expect(await screen.findByText('신고 접수 완료')).toBeInTheDocument()
  })
})
