'use server'

import { db } from '@/server/db'
import { uploadSources } from '@/server/db/schema'
import { createAdminClient } from '@/server/lib/supabase/admin'
import type { BBox, UploadCandidate, AnalyzeResponse, PrivacyRegion } from '@/features/uploads/types/upload'
import {
  analyzeBannerInputSchema,
  detectedBannerListSchema,
} from '@/features/uploads/schemas/upload-schema'
import { GoogleGenerativeAI } from '@google/generative-ai'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

async function compressSource(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 4800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, effort: 4 })
    .toBuffer()
}

type MultiBannerAnalysis = {
  candidates: UploadCandidate[]
  privacyRegions: PrivacyRegion[]
}

function toFriendlyAnalyzeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const isQuotaError =
    message.includes('429 Too Many Requests') ||
    message.includes('Quota exceeded') ||
    message.includes('generate_content_free_tier')

  const isOverloadError =
    message.includes('503 Service Unavailable') ||
    message.includes('high demand') ||
    message.includes('Service Unavailable')

  if (isOverloadError) {
    return new Error('AI 분석 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해 주세요.')
  }

  if (!isQuotaError) {
    return error instanceof Error ? error : new Error('현수막 분석 중 오류가 발생했습니다.')
  }

  const retryMatch = message.match(/retry in ([\d.]+)s/i)
  const retrySeconds = retryMatch?.[1] ? Math.ceil(Number(retryMatch[1])) : null
  const retryText = retrySeconds ? `${retrySeconds}초 후 다시 시도해 주세요.` : '잠시 후 다시 시도해 주세요.'

  return new Error(
    `AI 분석 요청 한도를 초과했습니다 (Gemini 429). 결제/쿼터 설정을 확인하고 ${retryText}`,
  )
}

const DETECTION_PROMPT = `이 사진에서 보이는 모든 현수막을 감지하고, 개인정보 보호 대상(얼굴·번호판)도 감지하여 아래 JSON 형식으로만 응답하세요.

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
  ],
  "privacyRegions": [
    {
      "type": "face",
      "bbox": { "x": 0.10, "y": 0.05, "width": 0.08, "height": 0.12 }
    },
    {
      "type": "licensePlate",
      "bbox": { "x": 0.45, "y": 0.70, "width": 0.15, "height": 0.05 }
    }
  ]
}

규칙:
- 멀리 작게 보이는 현수막도 놓치지 말고 감지
- bbox는 이미지 전체 크기 대비 비율(0.0~1.0)로 표현. x·y는 좌상단, width·height는 크기
- tempId는 "banner_0", "banner_1" 순으로 부여
- title: 현수막에서 가장 중심이 되는 한 문장 또는 슬로건
- hashtags: 주제, 주체, 요구사항, 장소를 나타내는 한국어 키워드 최대 12개, # 기호 없이
- subjectType: "정치인", "정당", "기타", null 중 하나
- confidence: 현수막 감지 신뢰도 (0.0~1.0)
- privacyRegions.type: "face" (사람 얼굴) 또는 "licensePlate" (한국 차량 번호판)
- 현수막이 없으면: { "banners": [], "privacyRegions": [] }`

function parseDetectedBannerResponse(raw: string) {
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // Gemini occasionally wraps JSON with markdown/code fences or extra text.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      // Continue to object extraction fallback.
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const objectLike = trimmed.slice(firstBrace, lastBrace + 1)
    return JSON.parse(objectLike)
  }

  throw new Error('AI 응답에서 JSON을 파싱할 수 없습니다.')
}

async function buildAnalysisImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 2560, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function detectBanners(imageBuffer: Buffer, mimeType: string): Promise<MultiBannerAnalysis> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
    generationConfig: {
      responseMimeType: 'application/json',
    },
    systemInstruction:
      '당신은 사진 속의 현수막을 감지하고 분석하는 전문 AI입니다. 이미지에서 보이는 모든 현수막을 찾아 위치와 내용을 추출하고, 개인정보 보호를 위해 사람 얼굴과 한국 차량 번호판도 함께 감지합니다.',
  })

  const result = await model.generateContent([
    {
      inlineData: { data: imageBuffer.toString('base64'), mimeType },
    },
    DETECTION_PROMPT,
  ])

  const raw = result.response.text()

  const parsed = detectedBannerListSchema.parse(parseDetectedBannerResponse(raw))
  const bannerList = parsed.banners

  const candidates: UploadCandidate[] = bannerList.map((b, idx) => {
    const bbox = b.bbox ?? {}
    const parsedBbox: BBox = {
      x: clamp(Number(bbox.x) || 0),
      y: clamp(Number(bbox.y) || 0),
      width: clamp(Number(bbox.width) || 1),
      height: clamp(Number(bbox.height) || 1),
    }

    return {
      tempId: typeof b.tempId === 'string' && b.tempId.length > 0 ? b.tempId : `banner_${idx}`,
      title: typeof b.title === 'string' ? b.title : null,
      hashtags: (b.hashtags ?? []).map((h) => h.trim()).filter((h) => h.length > 0).slice(0, 12),
      subjectType: typeof b.subjectType === 'string' ? b.subjectType : null,
      bbox: parsedBbox,
      confidence: clamp(Number(b.confidence) || 0.5),
    }
  })

  const privacyRegions: PrivacyRegion[] = parsed.privacyRegions.map((r) => ({
    type: r.type,
    bbox: {
      x: clamp(r.bbox.x),
      y: clamp(r.bbox.y),
      width: clamp(r.bbox.width),
      height: clamp(r.bbox.height),
    },
  }))

  return { candidates, privacyRegions }
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v))
}

// Fields:
//   image        File     현수막 사진 (JPG/PNG/WebP, 최대 20MB)
//   regionText   string   목격 위치 (필수)
//   observedAt   string   목격 날짜 ISO 8601 (필수)
//   subjectType  string   주체 유형 (선택)
export async function analyzeBanner(formData: FormData): Promise<AnalyzeResponse> {
  const { image: imageFile, regionText, observedAt, subjectType } = analyzeBannerInputSchema.parse({
    image: formData.get('image'),
    regionText: formData.get('regionText'),
    observedAt: formData.get('observedAt'),
    subjectType: formData.get('subjectType'),
  })

  const observedDate = new Date(observedAt)

  const originalBuffer = Buffer.from(await imageFile.arrayBuffer())

  const [sourceBuffer, analysisBuffer] = await Promise.all([
    compressSource(originalBuffer),
    buildAnalysisImage(originalBuffer),
  ])
  let analysis: MultiBannerAnalysis
  try {
    analysis = await detectBanners(analysisBuffer, 'image/jpeg')
  } catch (error) {
    throw toFriendlyAnalyzeError(error)
  }

  // Optional second pass. Disabled by default to avoid doubling Gemini quota usage.
  const enableSecondPass = process.env.ENABLE_ANALYZE_SECOND_PASS === 'true'
  if (enableSecondPass && analysis.candidates.length === 0) {
    try {
      analysis = await detectBanners(sourceBuffer, 'image/webp')
    } catch (error) {
      throw toFriendlyAnalyzeError(error)
    }
  }

  const sourceId = randomUUID()
  const sourcePath = `sources/${sourceId}.webp`
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!

  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(sourcePath, sourceBuffer, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    throw new Error(`원본 이미지 업로드 실패: ${uploadError.message}`)
  }

  const [uploadSource] = await db
    .insert(uploadSources)
    .values({
      sourceImageUrl: sourcePath,
      regionText,
      observedAt: observedDate,
      subjectType,
      privacyRegionsJson: analysis.privacyRegions,
    })
    .returning()

  return {
    uploadSourceId: uploadSource.id,
    candidates: analysis.candidates,
    privacyRegions: analysis.privacyRegions,
  }
}
