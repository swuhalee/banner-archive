'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import {
  createBannerInputSchema,
  type CreateBannerInput,
} from '@/features/banners/schemas/banner-schema'

export type { CreateBannerInput }

export async function createBanner(input: CreateBannerInput) {
  const { title, hashtags, subjectType, regionText, firstSeenAt, lastSeenAt } =
    createBannerInputSchema.parse(input)

  const firstSeenDate = new Date(firstSeenAt)
  const lastSeenDate = new Date(lastSeenAt)

  const [banner] = await db
    .insert(banners)
    .values({
      title: title ?? null,
      hashtags: hashtags ?? [],
      subjectType: subjectType ?? null,
      regionText,
      firstSeenAt: firstSeenDate,
      lastSeenAt: lastSeenDate,
    })
    .returning()

  return banner
}
