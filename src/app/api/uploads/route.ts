import { db } from '@/server/db'
import { banners, images } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

// POST /api/uploads  (레거시 호환 — 내부적으로 analyze → commit 단일 후보 자동 확정)
// 신규 UI는 /api/uploads/analyze + /api/uploads/commit 을 직접 사용합니다.
export async function POST(request: NextRequest) {
  // analyze 엔드포인트로 요청 그대로 전달
  const analyzeRes = await fetch(new URL('/api/uploads/analyze', request.url), {
    method: 'POST',
    body: request.body,
    headers: request.headers,
    // @ts-expect-error Next.js fetch duplex
    duplex: 'half',
  })

  if (!analyzeRes.ok) {
    const body = (await analyzeRes.json().catch(() => ({}))) as { error?: string }
    return NextResponse.json(
      { error: body.error ?? '분석에 실패했습니다' },
      { status: analyzeRes.status },
    )
  }

  const analyzeData = (await analyzeRes.json()) as {
    uploadSourceId: string
    candidates: Array<{
      tempId: string
      title: string | null
      hashtags: string[]
      subjectType: string | null
      bbox: { x: number; y: number; width: number; height: number }
      confidence: number
    }>
  }

  if (analyzeData.candidates.length === 0) {
    return NextResponse.json(
      { error: '현수막을 인식할 수 없습니다. 다른 사진을 업로드해주세요.' },
      { status: 422 },
    )
  }

  // 레거시: 첫 번째 후보만 저장
  const candidates = [analyzeData.candidates[0]]

  // commit 엔드포인트 호출
  const commitRes = await fetch(new URL('/api/uploads/commit', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadSourceId: analyzeData.uploadSourceId,
      selectedCandidates: candidates,
    }),
  })

  if (!commitRes.ok) {
    const body = (await commitRes.json().catch(() => ({}))) as { error?: string }
    return NextResponse.json(
      { error: body.error ?? '저장에 실패했습니다' },
      { status: commitRes.status },
    )
  }

  const commitData = (await commitRes.json()) as { bannerIds: string[]; count: number }
  const bannerId = commitData.bannerIds[0]

  if (!bannerId) {
    return NextResponse.json({ error: '배너 저장에 실패했습니다' }, { status: 500 })
  }

  // 생성된 배너 + 이미지 조회하여 기존 응답 형식으로 반환
  const [banner] = await db.select().from(banners).where(eq(banners.id, bannerId))
  const [image] = await db.select().from(images).where(eq(images.bannerId, bannerId))

  return NextResponse.json(
    {
      ...banner,
      images: image
        ? [
            {
              ...image,
              maskedImageUrl: resolveStorageUrl(image.maskedImageUrl)!,
              originalImageUrl: resolveStorageUrl(image.originalImageUrl),
            },
          ]
        : [],
    },
    { status: 201 },
  )
}
