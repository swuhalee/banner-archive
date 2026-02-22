import { db } from '@/server/db'
import { banners, bannerSources, images, uploadSources } from '@/server/db/schema'
import { createAdminClient } from '@/server/lib/supabase/admin'
import type { BBox, CommitCandidate, RejectedDuplicate } from '@/features/uploads/types/upload'
import {
  DUPLICATE_THRESHOLD,
  findBestMatch,
  type ExistingBanner,
} from '@/server/services/banner-duplicate'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// ─── 이미지 압축 (uploads/route.ts와 동일) ──────────────────────────────────────

async function compressToTarget(
  input: Buffer,
  maxWidth: number,
  targetMaxKB: number,
  startQuality = 82,
): Promise<Buffer> {
  let quality = startQuality

  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await sharp(input)
      .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer()

    if (result.length <= targetMaxKB * 1024 || quality <= 30) return result
    quality = Math.max(30, quality - 8)
  }

  return sharp(input)
    .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 30, effort: 4 })
    .toBuffer()
}

// ─── bbox 기준 크롭 ──────────────────────────────────────────────────────────────

type AbsoluteBBox = { x: number; y: number; width: number; height: number }

type PrivacyRegionRaw = {
  type: string
  bbox: { x: number; y: number; width: number; height: number }
}

async function cropImage(
  rotatedBuffer: Buffer,
  bbox: BBox,
  imgWidth: number,
  imgHeight: number,
): Promise<{ buffer: Buffer; offset: AbsoluteBBox }> {
  // 수평: bbox 너비의 25% 여백 → 1.5배 폭
  const padX = bbox.width * 0.25
  // 수직: AI 인식이 실제보다 bbox 높이의 ~50% 아래에 치우쳐 있으므로
  //   상단 = 오프셋 보정(0.5) + 여백(0.25) = 0.75배 위로
  //   하단 = 여백(0.5) → 총 크롭 높이 ≈ 2.25배
  const topPad = bbox.height * 0.8
  const bottomPad = bbox.height * 0.8

  const left = Math.max(0, Math.floor((bbox.x - padX) * imgWidth))
  const top = Math.max(0, Math.floor((bbox.y - topPad) * imgHeight))
  const right = Math.min(imgWidth, Math.ceil((bbox.x + bbox.width + padX) * imgWidth))
  const bottom = Math.min(imgHeight, Math.ceil((bbox.y + bbox.height + bottomPad) * imgHeight))

  const cropWidth = Math.max(1, right - left)
  const cropHeight = Math.max(1, bottom - top)

  const buffer = await sharp(rotatedBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer()

  return { buffer, offset: { x: left, y: top, width: cropWidth, height: cropHeight } }
}

// ─── 개인정보 마스킹 ──────────────────────────────────────────────────────────────

async function blackBoxRegion(region: AbsoluteBBox): Promise<Buffer | null> {
  const { width, height } = region
  if (width <= 0 || height <= 0) return null
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
}

async function applyPrivacyMask(
  cropBuffer: Buffer,
  cropOffset: AbsoluteBBox,
  privacyRegions: PrivacyRegionRaw[],
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ buffer: Buffer; appliedRegions: AbsoluteBBox[] }> {
  if (privacyRegions.length === 0) return { buffer: cropBuffer, appliedRegions: [] }

  const composites: sharp.OverlayOptions[] = []
  const appliedRegions: AbsoluteBBox[] = []

  for (const region of privacyRegions) {
    // 소스 이미지 비율 좌표 → 크롭 이미지 기준 픽셀 좌표로 변환
    const relX = Math.round(region.bbox.x * sourceWidth - cropOffset.x)
    const relY = Math.round(region.bbox.y * sourceHeight - cropOffset.y)
    const relW = Math.round(region.bbox.width * sourceWidth)
    const relH = Math.round(region.bbox.height * sourceHeight)

    // 크롭 영역과 교차하는 부분만 처리
    const clampedX = Math.max(0, relX)
    const clampedY = Math.max(0, relY)
    const clampedW = Math.min(cropOffset.width, relX + relW) - clampedX
    const clampedH = Math.min(cropOffset.height, relY + relH) - clampedY

    console.log(`[mask-debug] region(${region.type}) abs=(${relX},${relY},${relW}x${relH}) → clamped=(${clampedX},${clampedY},${clampedW}x${clampedH}) cropSize=${cropOffset.width}x${cropOffset.height}`)
    if (clampedW <= 0 || clampedH <= 0) {
      console.log(`[mask-debug] → SKIPPED (범위 밖)`)
      continue
    }

    const pixelated = await blackBoxRegion({ x: clampedX, y: clampedY, width: clampedW, height: clampedH })
    if (pixelated) {
      composites.push({ input: pixelated, left: clampedX, top: clampedY })
      appliedRegions.push({ x: clampedX, y: clampedY, width: clampedW, height: clampedH })
    }
  }

  console.log(`[mask-debug] composites 적용 수: ${composites.length}`)
  if (composites.length === 0) return { buffer: cropBuffer, appliedRegions: [] }

  const maskedBuffer = await sharp(cropBuffer).composite(composites).toBuffer()
  return { buffer: maskedBuffer, appliedRegions }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

// POST /api/uploads/commit
// Content-Type: application/json
// Body: { uploadSourceId: string, selectedCandidates: CommitCandidate[] }
// Response: text/event-stream (SSE)
//   data: { progress: number }
//   data: { progress: 100, done: true, data: CommitResponse }
//   data: { error: string }
export async function POST(request: NextRequest) {
  // ── 1. 요청 파싱 및 검증 (스트림 시작 전에 처리) ─────────────────────────────
  let body: { uploadSourceId?: string; selectedCandidates?: CommitCandidate[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다' }, { status: 400 })
  }

  const { uploadSourceId, selectedCandidates } = body

  if (!uploadSourceId) {
    return NextResponse.json({ error: 'uploadSourceId는 필수입니다' }, { status: 400 })
  }
  if (!Array.isArray(selectedCandidates) || selectedCandidates.length === 0) {
    return NextResponse.json({ error: '저장할 현수막을 최소 1개 선택해주세요' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── 2. upload_sources 조회 (5%) ────────────────────────────────────────
        send({ progress: 5 })
        const [uploadSource] = await db
          .select()
          .from(uploadSources)
          .where(eq(uploadSources.id, uploadSourceId))

        if (!uploadSource) {
          send({ error: '업로드 원본을 찾을 수 없습니다' })
          controller.close()
          return
        }

        // ── 3. 중복 판정 (8%) ──────────────────────────────────────────────────
        send({ progress: 8 })

        // 활성 배너 전수 조회 (1차 필터: status='active')
        const existingBanners: ExistingBanner[] = await db
          .select({
            id: banners.id,
            title: banners.title,
            hashtags: banners.hashtags,
            subjectType: banners.subjectType,
            regionText: banners.regionText,
            lastSeenAt: banners.lastSeenAt,
          })
          .from(banners)
          .where(eq(banners.status, 'active'))

        const observedAt = uploadSource.observedAt
        const regionText = uploadSource.regionText

        console.log(`[dedup] 활성 배너 ${existingBanners.length}건 조회됨 (임계치: ${DUPLICATE_THRESHOLD}%)`)

        const rejectedDuplicates: RejectedDuplicate[] = []
        const nonDuplicates: CommitCandidate[] = []

        for (const candidate of selectedCandidates) {
          const best = findBestMatch(candidate, regionText, observedAt, existingBanners)
          console.log(
            `[dedup] 후보 "${candidate.title}" → 최고 유사도: ${best ? `${best.similarityScore.toFixed(1)}% (bannerId: ${best.matchedBannerId})` : '없음 (기존 배너 0건)'}`,
          )
          if (best && best.similarityScore >= DUPLICATE_THRESHOLD) {
            rejectedDuplicates.push({
              tempId: candidate.tempId,
              matchedBannerId: best.matchedBannerId,
              similarityScore: Math.round(best.similarityScore),
              threshold: DUPLICATE_THRESHOLD,
            })
          } else {
            nonDuplicates.push(candidate)
          }
        }

        // 모두 중복이면 이미지 처리 없이 즉시 반환
        if (nonDuplicates.length === 0) {
          send({
            progress: 100,
            done: true,
            data: {
              savedBannerIds: [],
              rejectedDuplicates,
              savedCount: 0,
              rejectedCount: rejectedDuplicates.length,
              bannerIds: [],
              count: 0,
            },
          })
          controller.close()
          return
        }

        const total = nonDuplicates.length

        // ── 4. 원본 이미지 다운로드 + EXIF 보정 (10%) ─────────────────────────
        send({ progress: 10 })
        const bucket = process.env.SUPABASE_STORAGE_BUCKET!
        const supabase = createAdminClient()

        const { data: sourceBlob, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(uploadSource.sourceImageUrl)

        if (downloadError || !sourceBlob) {
          send({ error: `원본 이미지 다운로드 실패: ${downloadError?.message ?? '알 수 없는 오류'}` })
          controller.close()
          return
        }

        const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer())
        const rotatedBuffer = await sharp(sourceBuffer).rotate().toBuffer()
        const { width: srcWidth = 1, height: srcHeight = 1 } = await sharp(rotatedBuffer).metadata()
        const rawPrivacyRegions = (uploadSource.privacyRegionsJson ?? []) as PrivacyRegionRaw[]
        console.log(`[mask-debug] privacyRegions from DB: ${rawPrivacyRegions.length}건`, JSON.stringify(rawPrivacyRegions))
        console.log(`[mask-debug] source image size: ${srcWidth}x${srcHeight}`)
        send({ progress: 20 })

        // ── 5. 각 후보별 크롭 + 마스킹 + 압축 + Storage 업로드 (20% → 88%) ──
        type CropUploadResult = {
          candidate: CommitCandidate
          thumbPath: string
          detailPath: string
          appliedRegions: AbsoluteBBox[]
        }

        let completed = 0
        const cropResults: CropUploadResult[] = await Promise.all(
          nonDuplicates.map(async (candidate) => {
            const { buffer: cropBuffer, offset: cropOffset } = await cropImage(rotatedBuffer, candidate.bbox, srcWidth, srcHeight)
            const { buffer: maskedBuffer, appliedRegions } = await applyPrivacyMask(cropBuffer, cropOffset, rawPrivacyRegions, srcWidth, srcHeight)

            const [thumbBuffer, detailBuffer] = await Promise.all([
              compressToTarget(maskedBuffer, 1200, 400, 78),
              compressToTarget(maskedBuffer, 2400, 1200, 85),
            ])

            const cropId = randomUUID()
            const thumbPath = `${cropId}-thumb.webp`
            const detailPath = `${cropId}-detail.webp`

            const [thumbResult, detailResult] = await Promise.all([
              supabase.storage.from(bucket).upload(thumbPath, thumbBuffer, {
                contentType: 'image/webp',
                upsert: false,
              }),
              supabase.storage.from(bucket).upload(detailPath, detailBuffer, {
                contentType: 'image/webp',
                upsert: false,
              }),
            ])

            if (thumbResult.error) throw new Error(`썸네일 업로드 실패: ${thumbResult.error.message}`)
            if (detailResult.error) throw new Error(`상세 이미지 업로드 실패: ${detailResult.error.message}`)

            completed++
            // 20% ~ 88% 구간을 현수막 수 기준으로 균등 배분
            send({ progress: Math.round(20 + (completed / total) * 68) })

            return { candidate, thumbPath, detailPath, appliedRegions }
          }),
        )

        // ── 6. DB 트랜잭션으로 배너 + 이미지 + banner_sources 일괄 삽입 (92%) ─
        send({ progress: 92 })

        const insertedBannerIds = await db.transaction(async (tx) => {
          const ids: string[] = []

          for (const { candidate, thumbPath, detailPath, appliedRegions } of cropResults) {
            const [banner] = await tx
              .insert(banners)
              .values({
                title: candidate.title,
                hashtags: candidate.hashtags,
                subjectType: candidate.subjectType ?? uploadSource.subjectType,
                regionText: uploadSource.regionText,
                firstSeenAt: observedAt,
                lastSeenAt: observedAt,
              })
              .returning()

            await tx
              .insert(images)
              .values({
                bannerId: banner.id,
                maskedImageUrl: thumbPath,
                originalImageUrl: detailPath,
                maskingStatus: 'success',
                maskingMetadata: appliedRegions.length > 0 ? { regions: appliedRegions } : null,
              })
              .returning()

            await tx.insert(bannerSources).values({
              bannerId: banner.id,
              uploadSourceId: uploadSource.id,
              bbox: candidate.bbox,
              confidence: candidate.confidence,
            })

            ids.push(banner.id)
          }

          return ids
        })

        // ── 완료 ────────────────────────────────────────────────────────────────
        send({
          progress: 100,
          done: true,
          data: {
            savedBannerIds: insertedBannerIds,
            rejectedDuplicates,
            savedCount: insertedBannerIds.length,
            rejectedCount: rejectedDuplicates.length,
            bannerIds: insertedBannerIds,
            count: insertedBannerIds.length,
          },
        })
        controller.close()
      } catch (err) {
        send({ error: err instanceof Error ? err.message : '저장에 실패했습니다' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
