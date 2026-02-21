'use server'

import { db } from '@/server/db'
import { appeals, banners } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

const VALID_REASON_TYPES = ['privacy', 'portrait', 'false_info', 'other'] as const
export type AppealReasonType = (typeof VALID_REASON_TYPES)[number]

export type SubmitAppealInput = {
  bannerId: string
  reasonType: AppealReasonType
  reasonDetail?: string
}

export async function submitAppeal({ bannerId, reasonType, reasonDetail }: SubmitAppealInput) {
  if (!VALID_REASON_TYPES.includes(reasonType)) {
    throw new Error(`reasonType은 ${VALID_REASON_TYPES.join(', ')} 중 하나여야 합니다`)
  }

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
