'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { and, count, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import type { BannerListResponse } from '@/features/banners/types/banner'
import {
  bannerListParamsSchema,
  type BannerListParams,
} from '@/features/banners/schemas/banner-schema'

export async function fetchBanners(params: BannerListParams = {}): Promise<BannerListResponse> {
  const {
    q = null,
    from = null,
    to = null,
    hashtag = null,
    region = null,
    subjectType = null,
    page,
    limit,
  } = bannerListParamsSchema.parse(params)
  const offset = (page - 1) * limit

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null

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
    images: banner.images
      .filter((img) => img.maskedImageUrl != null) // maskedImageUrl이 없는 이미지는 제외
      .map((img) => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
        maskedImageUrl: resolveStorageUrl(img.maskedImageUrl)!, // maskedImageUrl는 실제 사용 img라 반드시 존재해야 함
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
