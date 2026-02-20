import { db } from '@/server/db'
import { banners, images } from '@/server/db/schema'
import { createAdminClient } from '@/utils/supabase/admin'
import { resolveStorageUrl } from '@/utils/supabase/storage'
import OpenAI from 'openai'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// ─── 이미지 압축 ───────────────────────────────────────────────────────────────

/**
 * 이미지를 WebP로 변환하면서 목표 크기 이하가 될 때까지 품질을 점진적으로 낮춤.
 * @param input        원본 이미지 Buffer
 * @param maxWidth     리사이즈 최대 너비 (px)
 * @param targetMaxKB  목표 최대 파일 크기 (KB)
 * @param startQuality 시작 WebP 품질 (0–100)
 */
async function compressToTarget(
  input: Buffer,
  maxWidth: number,
  targetMaxKB: number,
  startQuality = 82,
): Promise<Buffer> {
  let quality = startQuality

  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await sharp(input)
      .rotate()                                                          // EXIF orientation 자동 보정
      .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer()

    if (result.length <= targetMaxKB * 1024 || quality <= 30) return result
    quality = Math.max(30, quality - 8)
  }

  // 최저 품질(30) fallback
  return sharp(input)
    .rotate()
    .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 30, effort: 4 })
    .toBuffer()
}

// ─── OpenAI 분석 ──────────────────────────────────────────────────────────────

type BannerAnalysis = {
  title: string | null
  hashtags: string[]
}

async function analyzeBannerImage(
  base64: string,
  mimeType: string
): Promise<BannerAnalysis> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_BANNER_TITLE_MODEL!,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 정치인, 정당 현수막 이미지를 분석하는 AI입니다. 이미지에서 현수막의 핵심 문구와 관련 키워드를 추출합니다.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: 'text',
            text: `이 현수막 이미지를 분석하여 아래 JSON 형식으로만 응답하세요.

{
  "title": "현수막의 핵심 슬로건 또는 주요 문구 (없거나 판독 불가면 null)",
  "hashtags": ["키워드1", "키워드2"] // 내용을 잘 표현하는 한국어 키워드 최대 12개, # 기호 없이
}

규칙:
- title: 현수막에서 가장 중심이 되는 한 문장 또는 슬로건. 텍스트가 없거나 읽기 어려우면 null
- hashtags: 주제, 주체, 요구사항, 장소 등을 나타내는 구체적인 키워드. 최대 12개`,
          },
        ],
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      title: typeof parsed.title === 'string' ? parsed.title : null,
      hashtags: Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[])
          .filter((t) => typeof t === 'string')
          .slice(0, 12)
        : [],
    }
  } catch {
    return { title: null, hashtags: [] }
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

// POST /api/uploads
// Content-Type: multipart/form-data
// Fields:
//   image        File     현수막 이미지 (JPG/PNG/WebP, 최대 20MB)
//   regionText   string   목격 위치 (필수)
//   observedAt   string   목격 날짜 ISO 8601 (필수)
//   subjectType  string   주체 유형 (선택)
export async function POST(request: NextRequest) {
  // ── 1. 폼 데이터 파싱 ────────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '폼 데이터를 파싱할 수 없습니다' }, { status: 400 })
  }

  const imageFile = formData.get('image')
  const regionText = (formData.get('regionText') as string | null)?.trim()
  const observedAt = formData.get('observedAt') as string | null
  const subjectType = (formData.get('subjectType') as string | null)?.trim() || null

  // ── 2. 입력 검증 ─────────────────────────────────────────────────────────────
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: 'image 파일이 필요합니다' }, { status: 400 })
  }
  if (!regionText) {
    return NextResponse.json({ error: 'regionText는 필수입니다' }, { status: 400 })
  }
  if (!observedAt) {
    return NextResponse.json({ error: 'observedAt은 필수입니다' }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
    return NextResponse.json(
      { error: 'JPG, PNG, WebP 이미지만 업로드 가능합니다' },
      { status: 400 }
    )
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '이미지 크기는 20MB를 초과할 수 없습니다' }, { status: 400 })
  }

  const observedDate = new Date(observedAt)
  if (isNaN(observedDate.getTime())) {
    return NextResponse.json(
      { error: 'observedAt 날짜 형식이 올바르지 않습니다 (ISO 8601)' },
      { status: 400 }
    )
  }

  // ── 3. 이미지 읽기 + 압축 ────────────────────────────────────────────────────
  const originalBuffer = Buffer.from(await imageFile.arrayBuffer())
  const base64 = originalBuffer.toString('base64') // OpenAI 분석용 (원본 품질)

  // 두 가지 크기로 병렬 압축
  const [thumbBuffer, detailBuffer] = await Promise.all([
    compressToTarget(originalBuffer, 1200, 400, 78),   // 목록/썸네일: ≤400KB
    compressToTarget(originalBuffer, 2400, 1200, 85),  // 상세/확대: ≤1.2MB
  ])

  const fileId = randomUUID()
  const thumbPath = `${fileId}-thumb.webp`
  const detailPath = `${fileId}-detail.webp`
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!

  // ── 4. Storage 업로드 + OpenAI 분석 병렬 실행 ───────────────────────────────
  const supabase = createAdminClient()

  const [thumbResult, detailResult, analysis] = await Promise.all([
    supabase.storage.from(bucket).upload(thumbPath, thumbBuffer, {
      contentType: 'image/webp',
      upsert: false,
    }),
    supabase.storage.from(bucket).upload(detailPath, detailBuffer, {
      contentType: 'image/webp',
      upsert: false,
    }),
    analyzeBannerImage(base64, imageFile.type).catch(() => ({
      title: null,
      hashtags: [] as string[],
    })),
  ])

  if (thumbResult.error) {
    return NextResponse.json(
      { error: `썸네일 업로드 실패: ${thumbResult.error.message}` },
      { status: 500 }
    )
  }
  if (detailResult.error) {
    return NextResponse.json(
      { error: `상세 이미지 업로드 실패: ${detailResult.error.message}` },
      { status: 500 }
    )
  }

  // ── 5. 배너 + 이미지 레코드 생성 ────────────────────────────────────────────
  // DB에는 스토리지 경로만 저장 (버킷명/프로젝트 URL 변경에 영향받지 않음)
  const [banner] = await db
    .insert(banners)
    .values({
      title: analysis.title,
      hashtags: analysis.hashtags,
      subjectType,
      regionText,
      firstSeenAt: observedDate,
      lastSeenAt: observedDate,
    })
    .returning()

  const [image] = await db
    .insert(images)
    .values({
      bannerId: banner.id,
      originalImageUrl: detailPath,  // 상세/확대용 경로 (≤1.2MB)
      maskedImageUrl: thumbPath,     // 목록/썸네일용 경로 (≤400KB) — 마스킹 전 임시
      maskingStatus: 'pending',
    })
    .returning()

  // 응답에는 완전한 URL로 변환하여 반환
  return NextResponse.json({
    ...banner,
    images: [{
      ...image,
      maskedImageUrl: resolveStorageUrl(image.maskedImageUrl)!,
      originalImageUrl: resolveStorageUrl(image.originalImageUrl),
    }],
  }, { status: 201 })
}
