import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/banners/:id
// 배너 상세 조회 (연관 이미지 포함)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const banner = await db.query.banners.findFirst({
    where: eq(banners.id, id),
    with: {
      images: true,
    },
  })

  if (!banner) {
    return NextResponse.json({ error: '배너를 찾을 수 없습니다' }, { status: 404 })
  }

  return NextResponse.json(banner)
}
