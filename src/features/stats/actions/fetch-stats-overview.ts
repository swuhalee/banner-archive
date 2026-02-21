'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { and, count, countDistinct, eq, gte, ilike, lte, sql } from 'drizzle-orm'

export type StatsParams = {
  from?: string
  to?: string
  region?: string
  subjectType?: string
  hashtag?: string
  limit?: number
}

export type StatsOverviewResponse = {
  summary: {
    totalBanners: number
    totalRegions: number
    totalSubjects: number
  }
  byRegion: Array<{ region: string; count: number }>
  bySubjectType: Array<{ subjectType: string; count: number }>
  topHashtags: Array<{ tag: string; count: number; ratio: number }>
  timeSeries: Array<{ bucket: string; count: number }>
}

export async function fetchStatsOverview(params: StatsParams = {}): Promise<StatsOverviewResponse> {
  const from = params.from || null
  const to = params.to || null
  const region = params.region || null
  const subjectType = params.subjectType || null
  const hashtag = params.hashtag || null
  const limit = Math.min(50, Math.max(1, params.limit ?? 10))

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null

  if (fromDate && isNaN(fromDate.getTime())) {
    throw new Error('from 날짜 형식이 올바르지 않습니다')
  }
  if (toDate && isNaN(toDate.getTime())) {
    throw new Error('to 날짜 형식이 올바르지 않습니다')
  }

  const where = and(
    eq(banners.status, 'active'),
    fromDate ? gte(banners.firstSeenAt, fromDate) : undefined,
    toDate ? lte(banners.firstSeenAt, toDate) : undefined,
    region ? ilike(banners.regionText, `%${region}%`) : undefined,
    subjectType ? eq(banners.subjectType, subjectType) : undefined,
    hashtag ? sql`${banners.hashtags} @> ARRAY[${hashtag}]::text[]` : undefined,
  )

  const rawConditions = [sql`status = 'active'`]
  if (fromDate) rawConditions.push(sql`first_seen_at >= ${fromDate}`)
  if (toDate) rawConditions.push(sql`first_seen_at <= ${toDate}`)
  if (region) rawConditions.push(sql`region_text ILIKE ${'%' + region + '%'}`)
  if (subjectType) rawConditions.push(sql`subject_type = ${subjectType}`)
  if (hashtag) rawConditions.push(sql`hashtags @> ARRAY[${hashtag}]::text[]`)
  const rawWhere = sql.join(rawConditions, sql` AND `)

  const [summaryResult, byRegionResult, bySubjectResult, topHashtagsResult, timeSeriesResult] =
    await Promise.all([
      db
        .select({
          totalBanners: count(),
          totalRegions: countDistinct(banners.regionText),
          totalSubjects: countDistinct(banners.subjectType),
        })
        .from(banners)
        .where(where),

      db
        .select({ region: banners.regionText, count: count() })
        .from(banners)
        .where(where)
        .groupBy(banners.regionText)
        .orderBy(sql`count(*) DESC`)
        .limit(limit),

      db
        .select({
          subjectType: sql<string>`COALESCE(${banners.subjectType}, '미분류')`,
          count: count(),
        })
        .from(banners)
        .where(where)
        .groupBy(sql`COALESCE(${banners.subjectType}, '미분류')`)
        .orderBy(sql`count(*) DESC`),

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

      db.execute(sql`
        SELECT date_trunc('day', first_seen_at)::date::text AS bucket, COUNT(*)::int AS count
        FROM banners
        WHERE ${rawWhere}
        GROUP BY bucket
        ORDER BY bucket ASC
      `),
    ])

  const total = summaryResult[0].totalBanners

  return {
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
  }
}
