import { db } from '@/server/db'
import { appeals, banners } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

const VALID_REASON_TYPES = ['privacy', 'portrait', 'false_info', 'other'] as const
type ReasonType = (typeof VALID_REASON_TYPES)[number]

// POST /api/appeals
// Body: { bannerId, reasonType, reasonDetail? }
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다' }, { status: 400 })
  }

  const { bannerId, reasonType, reasonDetail } = body as Record<string, unknown>

  if (!bannerId || typeof bannerId !== 'string') {
    return NextResponse.json({ error: 'bannerId는 필수입니다' }, { status: 400 })
  }

  if (!reasonType || !VALID_REASON_TYPES.includes(reasonType as ReasonType)) {
    return NextResponse.json(
      { error: `reasonType은 ${VALID_REASON_TYPES.join(', ')} 중 하나여야 합니다` },
      { status: 400 }
    )
  }

  const banner = await db.query.banners.findFirst({
    where: eq(banners.id, bannerId),
    columns: { id: true, status: true },
  })

  if (!banner) {
    return NextResponse.json({ error: '배너를 찾을 수 없습니다' }, { status: 404 })
  }

  if (banner.status === 'deleted') {
    return NextResponse.json({ error: '삭제된 배너입니다' }, { status: 410 })
  }

  const [appeal] = await db
    .insert(appeals)
    .values({
      bannerId,
      reasonType: reasonType as ReasonType,
      reasonDetail: typeof reasonDetail === 'string' && reasonDetail.trim() ? reasonDetail.trim() : null,
    })
    .returning()

  return NextResponse.json(appeal, { status: 201 })
}
