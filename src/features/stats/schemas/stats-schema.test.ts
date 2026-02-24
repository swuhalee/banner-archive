import { describe, expect, it } from 'vitest'
import { statsParamsSchema } from '@/features/stats/schemas/stats-schema'

describe('statsParamsSchema', () => {
  it('기본 limit 값을 적용한다', () => {
    const parsed = statsParamsSchema.parse({})
    expect(parsed.limit).toBe(10)
  })

  it('limit을 숫자로 변환하고 범위를 검증한다', () => {
    expect(statsParamsSchema.parse({ limit: '25' }).limit).toBe(25)
    expect(statsParamsSchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(statsParamsSchema.safeParse({ limit: 51 }).success).toBe(false)
  })

  it('optional 문자열 입력을 정규화한다', () => {
    const parsed = statsParamsSchema.parse({
      region: '  ',
      subjectType: ' 정치인 ',
      hashtag: '  ',
    })

    expect(parsed.region).toBeUndefined()
    expect(parsed.subjectType).toBe('정치인')
    expect(parsed.hashtag).toBeUndefined()
  })

  it('유효하지 않은 날짜 문자열은 거부한다', () => {
    expect(statsParamsSchema.safeParse({ from: 'invalid' }).success).toBe(false)
    expect(statsParamsSchema.safeParse({ to: '2026-02-23' }).success).toBe(true)
  })
})
