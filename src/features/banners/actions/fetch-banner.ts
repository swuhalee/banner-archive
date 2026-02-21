'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { eq } from 'drizzle-orm'
import type { BannerWithImages } from '@/features/banners/types/banner'

export async function fetchBanner(id: string): Promise<BannerWithImages> {
  const banner = await db.query.banners.findFirst({
    where: eq(banners.id, id),
    with: { images: true },
  })

  if (!banner) {
    throw new Error('배너를 찾을 수 없습니다')
  }

  return {
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
  }
}
