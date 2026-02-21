import { db } from '@/server/db'
import { banners } from '@/server/db/schema'
import { resolveStorageUrl } from '@/server/lib/supabase/storage'
import { and, count, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/banners
// Query params:
//   q        - 키워드 검색 (title, hashtags)
//   from     - 최초 목격일 시작 (ISO 8601)
//   to       - 최초 목격일 종료 (ISO 8601)
//   hashtag  - 해시태그 (정확 일치)
//   region   - 위치 (부분 일치)
//   page     - 페이지 번호 (기본값 1)
//   limit    - 페이지당 항목 수 (기본값 20, 최대 100)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const q = searchParams.get('q')?.trim() || null
  const from = searchParams.get('from') || null
  const to = searchParams.get('to') || null
  const hashtag = searchParams.get('hashtag') || null
  const region = searchParams.get('region') || null
  const subjectType = searchParams.get('subjectType')?.trim() || null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(to) : null

  if (fromDate && isNaN(fromDate.getTime())) {
    return NextResponse.json({ error: 'from 날짜 형식이 올바르지 않습니다' }, { status: 400 })
  }
  if (toDate && isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'to 날짜 형식이 올바르지 않습니다' }, { status: 400 })
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
    images: banner.images.map((img) => ({
      ...img,
      maskedImageUrl: resolveStorageUrl(img.maskedImageUrl)!,
      originalImageUrl: resolveStorageUrl(img.originalImageUrl),
    })),
  }))

  return NextResponse.json({
    data: resolved,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// POST /api/banners
// Body: { title?, hashtags?, subjectType?, regionText, firstSeenAt, lastSeenAt }
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다' }, { status: 400 })
  }

  const { title, hashtags, subjectType, regionText, firstSeenAt, lastSeenAt } =
    body as Record<string, unknown>

  if (!regionText || typeof regionText !== 'string') {
    return NextResponse.json({ error: 'regionText는 필수입니다' }, { status: 400 })
  }
  if (!firstSeenAt || !lastSeenAt) {
    return NextResponse.json(
      { error: 'firstSeenAt, lastSeenAt은 필수입니다' },
      { status: 400 }
    )
  }

  const firstSeenDate = new Date(firstSeenAt as string)
  const lastSeenDate = new Date(lastSeenAt as string)

  if (isNaN(firstSeenDate.getTime()) || isNaN(lastSeenDate.getTime())) {
    return NextResponse.json(
      { error: '날짜 형식이 올바르지 않습니다 (ISO 8601)' },
      { status: 400 }
    )
  }

  if (firstSeenDate > lastSeenDate) {
    return NextResponse.json(
      { error: 'firstSeenAt은 lastSeenAt보다 이전이어야 합니다' },
      { status: 400 }
    )
  }

  const [banner] = await db
    .insert(banners)
    .values({
      title: typeof title === 'string' ? title : null,
      hashtags: Array.isArray(hashtags) ? (hashtags as string[]) : [],
      subjectType: typeof subjectType === 'string' ? subjectType : null,
      regionText,
      firstSeenAt: firstSeenDate,
      lastSeenAt: lastSeenDate,
    })
    .returning()

  return NextResponse.json(banner, { status: 201 })
}
