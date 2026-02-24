/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UploadNavLink from '@/features/uploads/components/upload-nav-link'

vi.mock('next/navigation', () => ({
  usePathname: () => '/archive',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('UploadNavLink', () => {
  it('현재 경로를 from 쿼리로 포함한 업로드 링크를 렌더한다', () => {
    render(<UploadNavLink />)
    const link = screen.getByRole('link', { name: '업로드' })
    expect(link).toHaveAttribute('href', '/upload?from=%2Farchive')
  })
})
