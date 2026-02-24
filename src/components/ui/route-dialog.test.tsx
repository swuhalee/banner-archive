/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RouteDialog from '@/components/ui/route-dialog'

const { backMock, replaceMock } = vi.hoisted(() => ({
  backMock: vi.fn(),
  replaceMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, replace: replaceMock }),
}))

vi.mock('@headlessui/react', () => ({
  Dialog: ({
    onClose,
    children,
  }: {
    onClose: () => void
    children: unknown
  }) => (
    <div>
      <button onClick={onClose}>close</button>
      {children}
    </div>
  ),
  DialogPanel: ({ children }: { children: unknown }) => <div>{children}</div>,
}))

describe('RouteDialog', () => {
  let historyLengthSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    historyLengthSpy = vi.spyOn(window.history, 'length', 'get')
  })

  afterEach(() => {
    historyLengthSpy.mockRestore()
  })

  it('history가 있으면 닫기 시 router.back을 호출한다', () => {
    historyLengthSpy.mockReturnValue(2)
    render(
      <RouteDialog ariaLabel="모달" dialogClassName="dialog" closeHref="/archive">
        내용
      </RouteDialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(backMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('history가 없으면 closeHref로 router.replace를 호출한다', () => {
    historyLengthSpy.mockReturnValue(1)
    render(
      <RouteDialog ariaLabel="모달" dialogClassName="dialog" closeHref="/archive">
        내용
      </RouteDialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(backMock).not.toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/archive')
  })

  it('disableOutsideClose=true이면 닫기 이벤트를 무시한다', () => {
    historyLengthSpy.mockReturnValue(2)
    render(
      <RouteDialog ariaLabel="모달" dialogClassName="dialog" closeHref="/archive" disableOutsideClose>
        내용
      </RouteDialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(backMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
