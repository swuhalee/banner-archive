import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeSimilarityScore,
  findBestMatch,
  DUPLICATE_THRESHOLD,
  type ExistingBanner,
} from '@/server/services/banner-duplicate'

const baseCandidate = {
  title: '서울 교통 정책 개선',
  hashtags: ['서울', '교통', '정책'],
  subjectType: '정당',
}

const baseExisting: ExistingBanner = {
  id: 'banner-1',
  title: '서울 교통 정책 개선',
  hashtags: ['서울', '교통', '정책'],
  subjectType: '정당',
  lastSeenAt: new Date('2026-02-20T00:00:00.000Z'),
}

describe('computeSimilarityScore', () => {
  it('모든 신호가 동일하면 점수는 100에 가깝다', () => {
    const result = computeSimilarityScore(
      baseCandidate,
      new Date('2026-02-20T00:00:00.000Z'),
      baseExisting,
    )

    expect(result.matchedBannerId).toBe('banner-1')
    expect(result.similarityScore).toBeCloseTo(100, 5)
  })

  it('관측일 차이가 커질수록 점수가 낮아진다', () => {
    const near = computeSimilarityScore(
      baseCandidate,
      new Date('2026-02-21T00:00:00.000Z'),
      baseExisting,
    ).similarityScore

    const far = computeSimilarityScore(
      baseCandidate,
      new Date('2026-04-10T00:00:00.000Z'),
      baseExisting,
    ).similarityScore

    expect(far).toBeLessThan(near)
  })
})

describe('findBestMatch', () => {
  it('비교 대상 배너가 없으면 null을 반환한다', () => {
    const result = findBestMatch(baseCandidate, new Date('2026-02-20T00:00:00.000Z'), [])
    expect(result).toBeNull()
  })

  it('가장 높은 점수의 기존 배너를 반환한다', () => {
    const best = findBestMatch(baseCandidate, new Date('2026-02-20T00:00:00.000Z'), [
      {
        id: 'low-score',
        title: '완전히 다른 제목',
        hashtags: ['무관'],
        subjectType: '기타',
        lastSeenAt: new Date('2025-12-01T00:00:00.000Z'),
      },
      baseExisting,
    ])

    expect(best?.matchedBannerId).toBe('banner-1')
  })
})

describe('DUPLICATE_THRESHOLD 환경변수 처리', () => {
  const original = process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT

  afterEach(() => {
    process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT = original
    vi.resetModules()
  })

  it('지원 범위 내 값이면 env 값을 사용한다', async () => {
    process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT = '80'
    vi.resetModules()

    const mod = await import('./banner-duplicate')
    expect(mod.DUPLICATE_THRESHOLD).toBe(80)
  })

  it('지원 범위를 벗어나면 75로 fallback한다', async () => {
    process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT = '10'
    vi.resetModules()

    const mod = await import('./banner-duplicate')
    expect(mod.DUPLICATE_THRESHOLD).toBe(75)
  })
})

describe('기본 threshold', () => {
  it('기본값은 지원 범위 내에 있다', () => {
    expect(DUPLICATE_THRESHOLD).toBeGreaterThanOrEqual(50)
    expect(DUPLICATE_THRESHOLD).toBeLessThanOrEqual(95)
  })
})
