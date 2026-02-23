import { describe, expect, it } from 'vitest'
import { sanitizeReturnPath } from '@/lib/return-path'

describe('sanitizeReturnPath', () => {
  it('returns a normalized allowed route', () => {
    expect(sanitizeReturnPath('/archive/?q=test')).toBe('/archive')
  })

  it('falls back for disallowed external style paths', () => {
    expect(sanitizeReturnPath('https://evil.com', '/stats')).toBe('/stats')
    expect(sanitizeReturnPath('//evil.com', '/stats')).toBe('/stats')
    expect(sanitizeReturnPath('/admin', '/stats')).toBe('/stats')
  })
})
