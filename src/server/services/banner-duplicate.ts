// 환경변수
const RAW = parseInt(process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT ?? '75', 10)

/** 중복 판정 임계치 (0~100). 50~95 범위 권장, 범위 이탈 시 기본값 75 사용
 *
 *  기본값 75%로 설정한 이유:
 *  - 같은 현수막을 두 번 촬영하면 AI가 해시태그를 다르게 추출할 수 있음 (Jaccard 0.25 이하)
 *  - 제목·위치·날짜가 완전 일치해도 해시태그 차이로 82%(이전 기준값)에 못 미치는 경우 발생
 *  - 75%는 "완전 동일 현수막이지만 AI 추출 차이"를 포괄하면서 오탐은 최소화함
 *  - UPLOAD_DUPLICATE_THRESHOLD_PERCENT 환경변수로 운영 튜닝 가능
 */
export const DUPLICATE_THRESHOLD = isNaN(RAW) || RAW < 50 || RAW > 95 ? 75 : RAW

// 정규화: 비교 전에 텍스트를 "비슷한 형태"로 맞춰서 오탐지/미탐지를 줄인다.
function normalizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/[^\uAC00-\uD7A3a-z0-9\s]/g, ' ') // 한글·영문·숫자·공백만 허용
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().replace(/[^\uAC00-\uD7A3a-z0-9]/g, '').trim()
}

// ***** 유사도 알고리즘 *****

/**
 * Jaro 유사도(0~1)
 *
 * Jaro가 무엇인가?
 * - 두 문자열이 얼마나 비슷한지 측정하는 문자열 유사도 알고리즘
 * - 같은 문자들이 비슷한 위치에 많이 있으면 점수가 높아짐
 * - 철자가 조금 다르거나 일부 오타가 있어도 어느 정도 비슷하다고 판단할 수 있음
 *
 * 직관:
 * - 1.0에 가까울수록 거의 같은 문자열
 * - 0.0에 가까울수록 많이 다른 문자열
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (!s1 || !s2) return 0

  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1)
  const s1Matches = new Array<boolean>(s1.length).fill(false)
  const s2Matches = new Array<boolean>(s2.length).fill(false)
  let matches = 0
  let transpositions = 0

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
  )
}

/**
 * Jaro-Winkler 유사도(0~1)
 * - 기본은 Jaro 점수
 * - 단어 앞부분(접두사)이 같으면 보너스 점수를 줌
 * - 예: "서울시..." / "서울..."처럼 시작이 같을 때 더 높은 점수를 주고 싶을 때 유용함
 */
function jaroWinkler(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2)
  let prefix = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** 제목 유사도: Jaro-Winkler와 토큰 Jaccard 중 최대값
 *  - Jaro-Winkler: 문자 순서 기반 (오타·부분 추출에 강함)
 *  - Token Jaccard: 단어 집합 기반 (어순 차이에 강함)
 *  - 두 알고리즘 중 더 높은 점수를 사용해, 같은데 다르다고 보는 문제(false negative)를 줄임
 */
function titleSimilarity(a: string | null, b: string | null): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0

  const charScore = jaroWinkler(na, nb)

  // 토큰 수준 Jaccard: 어순이 달라도 같은 단어면 높은 점수
  const tokensA = new Set(na.split(' ').filter(Boolean))
  const tokensB = new Set(nb.split(' ').filter(Boolean))
  const intersection = [...tokensA].filter((x) => tokensB.has(x)).length
  const union = new Set([...tokensA, ...tokensB]).size
  const tokenScore = union === 0 ? 1 : intersection / union

  return Math.max(charScore, tokenScore)
}

/** 해시태그 Jaccard 유사도
 *  - 교집합/합집합 비율
 *  - 같은 태그를 많이 공유할수록 1에 가까워짐
 */
function hashtagsSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(normalizeHashtag).filter(Boolean))
  const setB = new Set(b.map(normalizeHashtag).filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

/** 주체 유형 유사도
 *  - 동일: 1
 *  - 한쪽만 비어있음(null): 0.5 (정보가 부족하므로 중간 점수)
 *  - 불일치: 0
 */
function subjectTypeSimilarity(a: string | null, b: string | null): number {
  if (!a && !b) return 1
  if (!a || !b) return 0.5
  return a === b ? 1 : 0
}

/** 관측일 근접도
 *  - 7일 이내면 1.0 (거의 같은 시점으로 봄)
 *  - 30일 이상 차이나면 0.0
 *  - 그 사이(8~29일)는 선형으로 점수 감소
 */
function observedAtProximity(candidateDate: Date, bannerDate: Date): number {
  const diffDays = Math.abs((candidateDate.getTime() - bannerDate.getTime()) / 86_400_000)
  if (diffDays <= 7) return 1
  if (diffDays >= 30) return 0
  return 1 - (diffDays - 7) / 23
}

// Public 타입
export type ExistingBanner = {
  id: string
  title: string | null
  hashtags: string[]
  subjectType: string | null
  lastSeenAt: Date
}

export type SimilarityResult = {
  matchedBannerId: string
  similarityScore: number // 0~100
}

/**
 * 후보 1건과 기존 배너 1건의 가중 유사도 점수(0~100)를 계산함
 *
 * 가중치: title 0.45 · hashtags 0.35 · subjectType 0.10 · observedAt 0.10
 *
 * 왜 가중치를 두나?
 * - 제목/해시태그가 중복 판정에 상대적으로 중요하다고 보고 비중을 높임
 * - 날짜/주체는 보조 신호로 비중을 낮게 둠
 * - region은 쿼리 단계에서 동일 주소만 불러오므로 점수 계산에서 제외
 */
export function computeSimilarityScore(
  candidate: { title: string | null; hashtags: string[]; subjectType: string | null },
  observedAt: Date,
  existing: ExistingBanner,
): SimilarityResult {
  const titleScore = titleSimilarity(candidate.title, existing.title)
  const hashtagsScore = hashtagsSimilarity(candidate.hashtags, existing.hashtags)
  const subjectScore = subjectTypeSimilarity(candidate.subjectType, existing.subjectType)
  const observedScore = observedAtProximity(observedAt, existing.lastSeenAt)

  const similarityScore =
    (titleScore * 0.45 +
      hashtagsScore * 0.35 +
      subjectScore * 0.1 +
      observedScore * 0.1) *
    100

  return { matchedBannerId: existing.id, similarityScore }
}

/**
 * 후보 1개를 기준으로 기존 배너들 중 "가장 점수가 높은 1개"를 반환함
 * - 기존 배너가 없으면 null
 * - 이 함수가 반환한 최고 점수와 DUPLICATE_THRESHOLD를 비교해 중복 여부를 결정함
 */
export function findBestMatch(
  candidate: { title: string | null; hashtags: string[]; subjectType: string | null },
  observedAt: Date,
  existingBanners: ExistingBanner[],
): SimilarityResult | null {
  if (existingBanners.length === 0) return null
  const results = existingBanners.map((b) =>
    computeSimilarityScore(candidate, observedAt, b),
  )
  return results.reduce((best, curr) => (curr.similarityScore > best.similarityScore ? curr : best))
}
