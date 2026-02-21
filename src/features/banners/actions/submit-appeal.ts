'use server'

import { db } from '@/server/db'
import { appeals, banners } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import {
  submitAppealInputSchema,
  type AppealReasonType,
  type SubmitAppealInput,
} from '@/features/banners/schemas/banner-schema'

export type { AppealReasonType, SubmitAppealInput }

export async function submitAppeal(input: SubmitAppealInput) {
  const { bannerId, reasonType, reasonDetail } = submitAppealInputSchema.parse(input)

  const banner = await db.query.banners.findFirst({
    where: eq(banners.id, bannerId),
    columns: { id: true, status: true },
  })

  if (!banner) {
    throw new Error('배너를 찾을 수 없습니다')
  }

  if (banner.status === 'deleted') {
    throw new Error('삭제된 배너입니다')
  }

  const [appeal] = await db
    .insert(appeals)
    .values({
      bannerId,
      reasonType,
      reasonDetail: reasonDetail?.trim() || null,
    })
    .returning()

  return appeal
}
