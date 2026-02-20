import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { and, count, countDistinct, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/stats/overview
// Query params:
//   from        - ISO date (firstSeenAt 시작)
//   to          - ISO date (firstSeenAt 종료)
//   region      - 부분 일치
//   subjectType - 정확 일치
//   hashtag     - 정확 포함
//   limit       - top N (기본 10, 최대 50)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const from = searchParams.get('from') || null
  const to = searchParams.get('to') || null
  const region = searchParams.get('region') || null
  const subjectType = searchParams.get('subjectType') || null
  const hashtag = searchParams.get('hashtag') || null
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)))

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null

  if (fromDate && isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: 'from 날짜 형식이 올바르지 않습니다' }, { status: 400 })
  }
  if (toDate && isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'to 날짜 형식이 올바르지 않습니다' }, { status: 400 })
  }

  // Drizzle ORM 기반 WHERE 조건 (select/group 쿼리용)
  const where = and(
    eq(banners.status, 'active'),
    fromDate ? gte(banners.firstSeenAt, fromDate) : undefined,
    toDate ? lte(banners.firstSeenAt, toDate) : undefined,
    region ? ilike(banners.regionText, `%${region}%`) : undefined,
    subjectType ? eq(banners.subjectType, subjectType) : undefined,
    hashtag ? sql`${banners.hashtags} @> ARRAY[${hashtag}]::text[]` : undefined,
  )

  // raw SQL용 WHERE 절 구성 (unnest / date_trunc 쿼리에 사용)
  const rawConditions = [sql`status = 'active'`]
  if (fromDate) rawConditions.push(sql`first_seen_at >= ${fromDate}`)
  if (toDate) rawConditions.push(sql`first_seen_at <= ${toDate}`)
  if (region) rawConditions.push(sql`region_text ILIKE ${'%' + region + '%'}`)
  if (subjectType) rawConditions.push(sql`subject_type = ${subjectType}`)
  if (hashtag) rawConditions.push(sql`hashtags @> ARRAY[${hashtag}]::text[]`)
  const rawWhere = sql.join(rawConditions, sql` AND `)

  const [summaryResult, byRegionResult, bySubjectResult, topHashtagsResult, timeSeriesResult] =
    await Promise.all([
      // 요약 집계
      db
        .select({
          totalBanners: count(),
          totalRegions: countDistinct(banners.regionText),
          totalSubjects: countDistinct(banners.subjectType),
        })
        .from(banners)
        .where(where),

      // 지역별 건수
      db
        .select({ region: banners.regionText, count: count() })
        .from(banners)
        .where(where)
        .groupBy(banners.regionText)
        .orderBy(sql`count(*) DESC`)
        .limit(limit),

      // 주체별 건수 (NULL → '미분류')
      db
        .select({
          subjectType: sql<string>`COALESCE(${banners.subjectType}, '미분류')`,
          count: count(),
        })
        .from(banners)
        .where(where)
        .groupBy(sql`COALESCE(${banners.subjectType}, '미분류')`)
        .orderBy(sql`count(*) DESC`),

      // 해시태그 상위 (unnest)
      db.execute(sql`
        SELECT tag, COUNT(*)::int AS count
        FROM (
          SELECT unnest(hashtags) AS tag
          FROM banners
          WHERE ${rawWhere}
        ) t
        GROUP BY tag
        ORDER BY count DESC
        LIMIT ${limit}
      `),

      // 일별 추이
      db.execute(sql`
        SELECT date_trunc('day', first_seen_at)::date::text AS bucket, COUNT(*)::int AS count
        FROM banners
        WHERE ${rawWhere}
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
    ])

  const total = summaryResult[0].totalBanners

  return NextResponse.json({
    summary: {
      totalBanners: summaryResult[0].totalBanners,
      totalRegions: summaryResult[0].totalRegions,
      totalSubjects: summaryResult[0].totalSubjects,
    },
    byRegion: byRegionResult,
    bySubjectType: bySubjectResult,
    topHashtags: (topHashtagsResult as unknown as Array<{ tag: string; count: number }>).map(
      (r) => ({
        tag: r.tag,
        count: r.count,
        ratio: total > 0 ? Math.round((r.count / total) * 1000) / 1000 : 0,
      }),
    ),
    timeSeries: timeSeriesResult as unknown as Array<{ bucket: string; count: number }>,
  })
}
