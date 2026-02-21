'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { and, count, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import type { BannerListResponse } from '@/features/banners/types/banner'

export type BannerListParams = {
  q?: string
  from?: string
  to?: string
  hashtag?: string
  region?: string
  subjectType?: string
  page?: number
  limit?: number
}

export async function fetchBanners(params: BannerListParams = {}): Promise<BannerListResponse> {
  const q = params.q?.trim() || null
  const from = params.from || null
  const to = params.to || null
  const hashtag = params.hashtag || null
  const region = params.region || null
  const subjectType = params.subjectType?.trim() || null
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const offset = (page - 1) * limit

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
    q
      ? or(
          ilike(banners.title, `%${q}%`),
          sql`${banners.hashtags} @> ARRAY[${q}]::text[]`
        )
      : undefined,
    fromDate ? gte(banners.firstSeenAt, fromDate) : undefined,
    toDate ? lte(banners.firstSeenAt, toDate) : undefined,
    hashtag ? sql`${banners.hashtags} @> ARRAY[${hashtag}]::text[]` : undefined,
    region ? ilike(banners.regionText, `%${region}%`) : undefined,
    subjectType ? eq(banners.subjectType, subjectType) : undefined,
  )

  const [data, [{ total }]] = await Promise.all([
    db.query.banners.findMany({
      where,
      orderBy: (t, { desc: d }) => [d(t.firstSeenAt)],
      limit,
      offset,
      with: { images: true },
    }),
    db.select({ total: count() }).from(banners).where(where),
  ])

  const resolved = data.map((banner) => ({
    ...banner,
    firstSeenAt: banner.firstSeenAt.toISOString(),
    lastSeenAt: banner.lastSeenAt.toISOString(),
    createdAt: banner.createdAt.toISOString(),
    updatedAt: banner.updatedAt.toISOString(),
    images: banner.images.map((img) => ({
      ...img,
      createdAt: img.createdAt.toISOString(),
      maskedImageUrl: resolveStorageUrl(img.maskedImageUrl)!,
      originalImageUrl: resolveStorageUrl(img.originalImageUrl),
    })),
  }))

  return {
    data: resolved,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
