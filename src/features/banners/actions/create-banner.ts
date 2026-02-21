'use server'

import { db } from '@/server/db'
import { banners } from '@/server/db/schema'

export type CreateBannerInput = {
  title?: string
  hashtags?: string[]
  subjectType?: string
  regionText: string
  firstSeenAt: string
  lastSeenAt: string
}

export async function createBanner(input: CreateBannerInput) {
  const { title, hashtags, subjectType, regionText, firstSeenAt, lastSeenAt } = input

  const firstSeenDate = new Date(firstSeenAt)
  const lastSeenDate = new Date(lastSeenAt)

  if (isNaN(firstSeenDate.getTime()) || isNaN(lastSeenDate.getTime())) {
    throw new Error('날짜 형식이 올바르지 않습니다 (ISO 8601)')
  }

  if (firstSeenDate > lastSeenDate) {
    throw new Error('firstSeenAt은 lastSeenAt보다 이전이어야 합니다')
  }

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
