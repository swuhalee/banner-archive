'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { and, count, countDistinct, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import { statsParamsSchema, type StatsParams } from '@/features/stats/schemas/stats-schema'
import type { StatsOverviewResponse } from '@/features/stats/types/stats'

export async function fetchStatsOverview(params: StatsParams = {}): Promise<StatsOverviewResponse> {
  const parsedParams = statsParamsSchema.parse(params)
  const from = parsedParams.from || null
  const to = parsedParams.to || null
  const region = parsedParams.region || null
  const subjectType = parsedParams.subjectType || null
  const hashtag = parsedParams.hashtag || null
  const limit = parsedParams.limit

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null

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
