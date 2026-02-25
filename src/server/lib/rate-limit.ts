import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type WindowUnit = 's' | 'm' | 'h' | 'd'
type WindowString = `${number} ${WindowUnit}`

/**
 * Upstash Redis 기반 슬라이딩 윈도우 Rate Limiter를 생성합니다.
 *
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 환경 변수가 없으면 null을 반환합니다.
 * (로컬 개발 등 미설정 환경에서는 rate limiting을 건너뜁니다.)
 */
function createRateLimiter(requests: number, window: WindowString): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: 'banner-archive',
  })
}

/** /api/uploads/source-upload-url: IP당 60초에 30회 */
export const sourceUploadUrlRateLimiter = createRateLimiter(30, '60 s')
