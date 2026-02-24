import { describe, expect, it } from 'vitest'
import { sanitizeReturnPath } from '@/lib/return-path'

describe('sanitizeReturnPath', () => {
  it('허용된 내부 경로를 정규화해 반환한다', () => {
    expect(sanitizeReturnPath('/archive/?q=test')).toBe('/archive')
    expect(sanitizeReturnPath('/stats/#section')).toBe('/stats')
  })

  it('외부 URL 또는 비허용 경로는 fallback으로 대체한다', () => {
    expect(sanitizeReturnPath('https://evil.com', '/stats')).toBe('/stats')
    expect(sanitizeReturnPath('//evil.com', '/stats')).toBe('/stats')
    expect(sanitizeReturnPath('/\\evil', '/stats')).toBe('/stats')
    expect(sanitizeReturnPath('/admin', '/stats')).toBe('/stats')
  })

  it('입력이 비어 있으면 fallback을 반환한다', () => {
    expect(sanitizeReturnPath(undefined, '/archive')).toBe('/archive')
    expect(sanitizeReturnPath('', '/archive')).toBe('/archive')
  })
})
