/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ClientLayout from './layout'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: unknown }) => <a href={href}>{children}</a>,
}))

vi.mock('@/features/uploads', () => ({
  UploadNavLink: () => <a href="/upload?from=%2F">업로드</a>,
}))

describe('클라이언트 레이아웃', () => {
  it('헤더/네비게이션/모달 슬롯을 렌더한다', () => {
    render(
      <ClientLayout modal={<div>모달 슬롯</div>}>
        <div>페이지 본문</div>
      </ClientLayout>,
    )

    expect(screen.getByRole('link', { name: 'Banner Archive' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '아카이브' })).toHaveAttribute('href', '/archive')
    expect(screen.getByRole('link', { name: '통계' })).toHaveAttribute('href', '/stats')
    expect(screen.getByText('페이지 본문')).toBeInTheDocument()
    expect(screen.getByText('모달 슬롯')).toBeInTheDocument()
  })
})
