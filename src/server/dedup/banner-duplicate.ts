// ─── 환경변수 ─────────────────────────────────────────────────────────────────

const RAW = parseInt(process.env.UPLOAD_DUPLICATE_THRESHOLD_PERCENT ?? '75', 10)

/** 중복 판정 임계치 (0~100). 50~95 범위 권장; 범위 이탈 시 기본값 75 사용
 *
 *  기본값 75%로 설정한 이유:
 *  - 같은 현수막을 두 번 촬영하면 AI가 해시태그를 다르게 추출할 수 있음 (Jaccard 0.25 이하)
 *  - 제목·위치·날짜가 완전 일치해도 해시태그 차이로 82%에 못 미치는 경우 발생
 *  - 75%는 "완전 동일 현수막이지만 AI 추출 차이"를 포괄하면서 오탐은 최소화함
 *  - UPLOAD_DUPLICATE_THRESHOLD_PERCENT 환경변수로 운영 튜닝 가능
 */
export const DUPLICATE_THRESHOLD = isNaN(RAW) || RAW < 50 || RAW > 95 ? 75 : RAW

// ─── 정규화 ───────────────────────────────────────────────────────────────────

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

// ─── 유사도 알고리즘 ──────────────────────────────────────────────────────────

/** Jaro 유사도 */
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

/** Jaro-Winkler 유사도 (공통 접두사 최대 4자 보너스) */
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
 *  두 알고리즘 중 더 높은 점수를 사용해 false negative를 줄임
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

/** 해시태그 Jaccard 유사도 */
function hashtagsSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(normalizeHashtag).filter(Boolean))
  const setB = new Set(b.map(normalizeHashtag).filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

/** 지역 텍스트 토큰 Jaccard 유사도 */
function regionSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(' ').filter(Boolean))
  const tokensB = new Set(normalizeText(b).split(' ').filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  const intersection = [...tokensA].filter((x) => tokensB.has(x)).length
  const union = new Set([...tokensA, ...tokensB]).size
  return intersection / union
}

/** 주체 유형 유사도: 동일 1, 한쪽 null 0.5, 불일치 0 */
function subjectTypeSimilarity(a: string | null, b: string | null): number {
  if (!a && !b) return 1
  if (!a || !b) return 0.5
  return a === b ? 1 : 0
}

/** 관측일 근접도: 7일 이내 1.0, 30일 이상 0.0, 선형 감소 */
function observedAtProximity(candidateDate: Date, bannerDate: Date): number {
  const diffDays = Math.abs((candidateDate.getTime() - bannerDate.getTime()) / 86_400_000)
  if (diffDays <= 7) return 1
  if (diffDays >= 30) return 0
  return 1 - (diffDays - 7) / 23
}

// ─── Public 타입 / API ────────────────────────────────────────────────────────

export type ExistingBanner = {
  id: string
  title: string | null
  hashtags: string[]
  subjectType: string | null
  regionText: string
  lastSeenAt: Date
}

export type SimilarityResult = {
  matchedBannerId: string
  similarityScore: number // 0~100
}

/**
 * 후보 1건과 기존 배너 1건의 가중 유사도 점수(0~100)를 계산한다.
 *
 * 가중치: title 0.35 · hashtags 0.25 · region 0.20 · subjectType 0.10 · observedAt 0.10
 */
export function computeSimilarityScore(
  candidate: { title: string | null; hashtags: string[]; subjectType: string | null },
  regionText: string,
  observedAt: Date,
  existing: ExistingBanner,
): SimilarityResult {
  const titleScore = titleSimilarity(candidate.title, existing.title)
  const hashtagsScore = hashtagsSimilarity(candidate.hashtags, existing.hashtags)
  const regionScore = regionSimilarity(regionText, existing.regionText)
  const subjectScore = subjectTypeSimilarity(candidate.subjectType, existing.subjectType)
  const observedScore = observedAtProximity(observedAt, existing.lastSeenAt)

  const similarityScore =
    (titleScore * 0.35 +
      hashtagsScore * 0.25 +
      regionScore * 0.2 +
      subjectScore * 0.1 +
      observedScore * 0.1) *
    100

  return { matchedBannerId: existing.id, similarityScore }
}

/**
 * 후보에 대해 가장 유사한 기존 배너를 찾아 반환한다.
 * 기존 배너가 없으면 null.
 */
export function findBestMatch(
  candidate: { title: string | null; hashtags: string[]; subjectType: string | null },
  regionText: string,
  observedAt: Date,
  existingBanners: ExistingBanner[],
): SimilarityResult | null {
  if (existingBanners.length === 0) return null
  const results = existingBanners.map((b) =>
    computeSimilarityScore(candidate, regionText, observedAt, b),
  )
  return results.reduce((best, curr) => (curr.similarityScore > best.similarityScore ? curr : best))
}
