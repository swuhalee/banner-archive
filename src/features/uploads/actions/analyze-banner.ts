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

/*
  이 파일은 업로드 및 분석 단계를 담당하는 Server Action
  흐름:
  1) 입력값/파일 검증
  2) AI가 읽기 좋은 분석용 이미지 생성
  3) Gemini로 현수막/개인정보 영역 감지
  4) 원본(압축본)을 Storage에 저장
  5) upload_sources에 메타데이터 저장 후 uploadSourceId 반환
*/

async function compressSource(input: Buffer): Promise<Buffer> {
  // 저장용 원본 이미지를 너무 크지 않게 압축(WebP)
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

// Gemini 에러 메시지를 사용자가 이해하기 쉬운 문구로 교체
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
  // AI 응답에 공백/설명 텍스트가 섞일 수 있어 단계적으로 JSON을 추출
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // 1차 파싱 실패 시 아래 fallback으로 진행
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      // 2차 파싱 실패 시 마지막 fallback으로 진행
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
  // AI 분석용 이미지는 JPEG로 별도 생성 (모델이 WebP보다 JPEG을 더 잘 처리하는 것으로 보여서)
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

  // AI 출력(JSON)을 스키마로 검증해 형식 오류를 조기에 잡아냄
  const parsed = detectedBannerListSchema.parse(parseDetectedBannerResponse(raw))
  const bannerList = parsed.banners

  // AI 응답값을 내부 타입으로 정리하고, bbox/신뢰도는 0~1 범위로 보정(clamp) 
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

// 숫자를 min~max 범위 안으로 고정 (이상치 방어)
// 이상치: AI가 bbox 좌표나 신뢰도를 0~1 범위를 벗어나게 출력하는 경우가 종종 있어서, 이를 방지하기 위한 유틸 함수
function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v))
}

// Fields:
//   image        File     현수막 사진 (JPG/PNG/WebP, 최대 20MB)
//   regionText   string   목격 위치 (필수)
//   observedAt   string   목격 날짜 ISO 8601 (필수)
//   subjectType  string   주체 유형 (선택)
export async function analyzeBanner(formData: FormData): Promise<AnalyzeResponse> {
  // 1) 업로드 폼 입력값 검증
  const { image: imageFile, regionText, observedAt, subjectType } = analyzeBannerInputSchema.parse({
    image: formData.get('image'),
    regionText: formData.get('regionText'),
    observedAt: formData.get('observedAt'),
    subjectType: formData.get('subjectType'),
  })

  const observedDate = new Date(observedAt)

  // 2) 브라우저 File -> Node Buffer 변환
  const originalBuffer = Buffer.from(await imageFile.arrayBuffer())

  // 3) 저장용/분석용 이미지를 병렬로 생성
  const [sourceBuffer, analysisBuffer] = await Promise.all([
    compressSource(originalBuffer),
    buildAnalysisImage(originalBuffer),
  ])

  // 4) AI 분석 실행 (실패 시 사용자 친화 메시지로 변환)
  let analysis: MultiBannerAnalysis
  try {
    analysis = await detectBanners(analysisBuffer, 'image/jpeg')
  } catch (error) {
    throw toFriendlyAnalyzeError(error)
  }

  // 5) 선택적 2차 분석: 1차에서 후보가 0개일 때만 재시도 --> 기본은 OFF(쿼터/비용 증가 방지)
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

  // 6) 원본(압축본) 이미지를 Storage에 저장
  const supabase = createAdminClient()
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(sourcePath, sourceBuffer, { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    throw new Error(`원본 이미지 업로드 실패: ${uploadError.message}`)
  }

  // 7) upload_sources에 원본 경로/위치/날짜/개인정보 영역 메타데이터 저장
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

  // 8) 다음 단계(commit API)에서 사용할 식별자와 분석 결과 반환
  return {
    uploadSourceId: uploadSource.id,
    candidates: analysis.candidates,
    privacyRegions: analysis.privacyRegions,
  }
}
