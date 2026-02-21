import { db } from '@/server/db'
import { uploadSources } from '@/server/db/schema'
import { createAdminClient } from '@/utils/supabase/admin'
import type { BBox, UploadCandidate } from '@/features/banners/types/banner'
import OpenAI from 'openai'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// ─── 원본 보존용 압축 (크롭에 충분한 해상도 유지) ───────────────────────────────

async function compressSource(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 4800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, effort: 4 })
    .toBuffer()
}

// ─── OpenAI 다중 현수막 감지 ────────────────────────────────────────────────────

type MultiBannerAnalysis = {
  candidates: UploadCandidate[]
}

async function detectBanners(
  base64: string,
  mimeType: string,
): Promise<MultiBannerAnalysis> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_BANNER_TITLE_MODEL!,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '당신은 사진 속의 현수막을 감지하고 분석하는 전문 AI입니다. 이미지에서 보이는 모든 현수막을 찾아 위치와 내용을 추출합니다.',
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
            text: `이 사진에서 보이는 모든 현수막을 감지하여 아래 JSON 형식으로만 응답하세요.

{
  "banners": [
    {
      "tempId": "banner_0",
      "title": "현수막의 핵심 슬로건 또는 주요 문구 (없거나 판독 불가면 null)",
      "hashtags": ["키워드1", "키워드2"],
      "subjectType": "정치인 또는 정당 또는 기타 또는 null",
      "bbox": { "x": 0.10, "y": 0.05, "width": 0.80, "height": 0.60 },
      "confidence": 0.95
    }
  ]
}

규칙:
- bbox는 이미지 전체 크기 대비 비율(0.0~1.0)로 표현. x·y는 현수막 좌상단, width·height는 크기
- tempId는 "banner_0", "banner_1" 순으로 부여
- title: 현수막에서 가장 중심이 되는 한 문장 또는 슬로건
- hashtags: 주제, 주체, 요구사항, 장소를 나타내는 한국어 키워드 최대 12개, # 기호 없이
- subjectType: "정치인", "정당", "기타", null 중 하나
- confidence: 현수막 감지 신뢰도 (0.0~1.0)
- 현수막이 없으면: { "banners": [] }`,
          },
        ],
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const banners = Array.isArray(parsed.banners) ? parsed.banners : []

    const candidates: UploadCandidate[] = banners
      .filter((b): b is Record<string, unknown> => typeof b === 'object' && b !== null)
      .map((b, idx) => {
        const bbox = (b.bbox as Record<string, unknown>) ?? {}
        const parsedBbox: BBox = {
          x: clamp(Number(bbox.x) || 0),
          y: clamp(Number(bbox.y) || 0),
          width: clamp(Number(bbox.width) || 1),
          height: clamp(Number(bbox.height) || 1),
        }

        return {
          tempId: typeof b.tempId === 'string' ? b.tempId : `banner_${idx}`,
          title: typeof b.title === 'string' ? b.title : null,
          hashtags: Array.isArray(b.hashtags)
            ? (b.hashtags as unknown[]).filter((h) => typeof h === 'string').slice(0, 12) as string[]
            : [],
          subjectType: typeof b.subjectType === 'string' ? b.subjectType : null,
          bbox: parsedBbox,
          confidence: clamp(Number(b.confidence) || 0.5),
        }
      })

    return { candidates }
  } catch {
    return { candidates: [] }
  }
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v))
}

// ─── Route Handler ────────────────────────────────────────────────────────────

// POST /api/uploads/analyze
// Content-Type: multipart/form-data
// Fields:
//   image        File     현수막 사진 (JPG/PNG/WebP, 최대 20MB)
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
      { status: 400 },
    )
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '이미지 크기는 20MB를 초과할 수 없습니다' }, { status: 400 })
  }

  const observedDate = new Date(observedAt)
  if (isNaN(observedDate.getTime())) {
    return NextResponse.json(
      { error: 'observedAt 날짜 형식이 올바르지 않습니다 (ISO 8601)' },
      { status: 400 },
    )
  }

  // ── 3. 이미지 처리 + 업로드 + 분석 병렬 실행 ─────────────────────────────────
  const originalBuffer = Buffer.from(await imageFile.arrayBuffer())
  const base64 = originalBuffer.toString('base64')

  const [sourceBuffer, analysis] = await Promise.all([
    compressSource(originalBuffer),
    detectBanners(base64, imageFile.type).catch(() => ({ candidates: [] as UploadCandidate[] })),
  ])

  const sourceId = randomUUID()
  const sourcePath = `sources/${sourceId}.webp`
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(sourcePath, sourceBuffer, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { error: `원본 이미지 업로드 실패: ${uploadError.message}` },
      { status: 500 },
    )
  }

  // ── 4. upload_sources 레코드 생성 ────────────────────────────────────────────
  const [uploadSource] = await db
    .insert(uploadSources)
    .values({
      sourceImageUrl: sourcePath,
      regionText,
      observedAt: observedDate,
      subjectType,
    })
    .returning()

  return NextResponse.json({
    uploadSourceId: uploadSource.id,
    candidates: analysis.candidates,
  })
}
