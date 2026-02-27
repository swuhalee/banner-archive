import { db } from '@/server/db'
import { banners, bannerSources, images, uploadSources } from '@/server/db/schema'
import { createAdminClient } from '@/server/lib/supabase/admin'
import {
  applyPrivacyMask,
  compressToTarget,
  cropImage,
  type AbsoluteBBox,
  type PrivacyRegionRaw,
} from '@/server/lib/image-processing'
import type { CommitCandidate, RejectedDuplicate } from '@/features/uploads/types/upload'
import {
  DUPLICATE_THRESHOLD,
  findBestMatch,
  type ExistingBanner,
} from '@/server/services/banner-duplicate'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

/*
  이 파일의 역할
  - 사용자가 업로드 화면에서 "저장"을 누르면 이 API가 호출
  - 선택한 후보들을 중복 검사하고, 이미지 가공/업로드 후 DB에 저장
  - 작업이 길 수 있어서 SSE로 진행률(progress)을 계속 보내줌
    SSE(Server-Sent Events): 서버에서 클라이언트로 실시간으로 데이터를 푸시하는 기술

  왜 app/api 아래에 있나?
  - Next.js(App Router)에서 app/api/ 아래 route.ts 는 HTTP 엔드포인트로 자동 등록
  - 즉, 이 파일은 내부 유틸(lib)이 아니라 외부 요청을 직접 받는 진입점임
*/

// POST /api/uploads/commit
// Content-Type: application/json
// Body: { uploadSourceId: string, selectedCandidates: CommitCandidate[] }
// Response: text/event-stream (SSE)
//   data: { progress: number }
//   data: { progress: 100, done: true, data: CommitResponse }
//   data: { error: string }

// ─── 타입 ────────────────────────────────────────────────────────────────────

type CropUploadResult = {
  candidate: CommitCandidate
  maskedPath: string
  originalPath: string
  appliedRegions: AbsoluteBBox[]
}

type SSESend = (data: object) => void

// ─── 단계별 헬퍼 함수 ─────────────────────────────────────────────────────────

async function fetchUploadSource(id: string) {
  const [row] = await db
    .select()
    .from(uploadSources)
    .where(eq(uploadSources.id, id))
  return row ?? null
}

function deduplicateCandidates(
  candidates: CommitCandidate[],
  observedAt: Date,
  existingBanners: ExistingBanner[],
): { nonDuplicates: CommitCandidate[]; rejectedDuplicates: RejectedDuplicate[] } {
  const rejectedDuplicates: RejectedDuplicate[] = []
  const nonDuplicates: CommitCandidate[] = []

  for (const candidate of candidates) {
    const best = findBestMatch(candidate, observedAt, existingBanners)
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

  return { nonDuplicates, rejectedDuplicates }
}

// 각 후보를 병렬 처리: 크롭 → 개인정보 마스킹 → 압축 → 스토리지 업로드
// onProgress: 후보 1개 완료할 때마다 호출되는 진행률 콜백 (20~88% 구간)
async function processCrops(
  nonDuplicates: CommitCandidate[],
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  rotatedBuffer: Buffer,
  srcWidth: number,
  srcHeight: number,
  rawPrivacyRegions: PrivacyRegionRaw[],
  onProgress: (progress: number) => void,
): Promise<CropUploadResult[]> {
  const total = nonDuplicates.length
  let completed = 0

  return Promise.all(
    nonDuplicates.map(async (candidate) => {
      const { buffer: cropBuffer, offset: cropOffset } = await cropImage(
        rotatedBuffer, candidate.bbox, srcWidth, srcHeight,
      )
      const { buffer: maskedBuffer, appliedRegions } = await applyPrivacyMask(
        cropBuffer, cropOffset, rawPrivacyRegions, srcWidth, srcHeight,
      )

      const [maskedDetailBuffer, originalDetailBuffer] = await Promise.all([
        compressToTarget(maskedBuffer, 2400, 1200, 85),
        compressToTarget(cropBuffer, 2400, 1200, 85),
      ])

      const cropId = randomUUID()
      const maskedPath = `${cropId}-masked.webp`
      const originalPath = `${cropId}-original.webp`

      const [maskedResult, originalResult] = await Promise.all([
        supabase.storage.from(bucket).upload(maskedPath, maskedDetailBuffer, {
          contentType: 'image/webp',
          upsert: false,
        }),
        supabase.storage.from(bucket).upload(originalPath, originalDetailBuffer, {
          contentType: 'image/webp',
          upsert: false,
        }),
      ])
      if (maskedResult.error) throw new Error(`마스킹 이미지 업로드 실패: ${maskedResult.error.message}`)
      if (originalResult.error) throw new Error(`원본 이미지 업로드 실패: ${originalResult.error.message}`)

      // 20% ~ 88% 구간을 후보 수 기준으로 균등 배분
      completed++
      onProgress(Math.round(20 + (completed / total) * 68))

      return { candidate, maskedPath, originalPath, appliedRegions }
    }),
  )
}

// banners / images / banner_sources를 트랜잭션으로 한 묶음 저장, 중간 실패 시 롤백
async function saveBanners(
  cropResults: CropUploadResult[],
  uploadSource: { id: string; regionText: string; subjectType: string | null; observedAt: Date },
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const ids: string[] = []

    for (const { candidate, maskedPath, originalPath, appliedRegions } of cropResults) {
      const [banner] = await tx
        .insert(banners)
        .values({
          title: candidate.title,
          hashtags: candidate.hashtags,
          subjectType: candidate.subjectType ?? uploadSource.subjectType,
          regionText: uploadSource.regionText,
          firstSeenAt: uploadSource.observedAt,
          lastSeenAt: uploadSource.observedAt,
        })
        .returning()

      await tx
        .insert(images)
        .values({
          bannerId: banner.id,
          maskedImageUrl: maskedPath,
          originalImageUrl: originalPath,
          maskingStatus: 'success',
          maskingMetadata: appliedRegions.length > 0 ? { regions: appliedRegions } : null,
        })

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
}

// ─── POST 핸들러 ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1) 요청 본문(JSON) 파싱 + 필수값 검증
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

  // 2) SSE 스트림 준비
  // ReadableStream: controller.enqueue로 데이터를 넣고 controller.close로 종료
  const stream = new ReadableStream({
    async start(controller) {
      // 클라이언트가 EventSource로 읽을 수 있는 "data: ...\n\n" 포맷 전송 도우미
      const send: SSESend = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 3) 업로드 원본 메타데이터 조회
        send({ progress: 5 })
        const uploadSource = await fetchUploadSource(uploadSourceId)
        if (!uploadSource) {
          send({ error: '업로드 원본을 찾을 수 없습니다' })
          controller.close()
          return
        }

        // 4) 중복 판정: 같은 지역의 활성 배너와 비교해 임계치 이상이면 제외
        send({ progress: 8 })
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
          .where(and(eq(banners.status, 'active'), eq(banners.regionText, uploadSource.regionText)))

        const { nonDuplicates, rejectedDuplicates } = deduplicateCandidates(
          selectedCandidates,
          uploadSource.observedAt,
          existingBanners,
        )

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
            },
          })
          controller.close()
          return
        }

        // 5) 원본 이미지 다운로드 + EXIF 회전 보정 (bbox는 방향이 맞아야 정확하게 크롭됨)
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
        send({ progress: 20 })

        // 6) 각 후보 병렬 처리: 크롭 → 개인정보 마스킹 → 압축 → 업로드
        const cropResults = await processCrops(
          nonDuplicates,
          supabase,
          bucket,
          rotatedBuffer,
          srcWidth,
          srcHeight,
          rawPrivacyRegions,
          (progress) => send({ progress }),
        )

        // 7) DB 저장 (트랜잭션): banners / images / banner_sources를 한 묶음으로 저장
        send({ progress: 92 })
        const savedBannerIds = await saveBanners(cropResults, uploadSource)

        // 8) 완료 응답
        send({
          progress: 100,
          done: true,
          data: {
            savedBannerIds,
            rejectedDuplicates,
            savedCount: savedBannerIds.length,
            rejectedCount: rejectedDuplicates.length,
          },
        })
        controller.close()
      } catch (err) {
        send({ error: err instanceof Error ? err.message : '저장에 실패했습니다' })
        controller.close()
      }
    },
  })

  // SSE 응답 헤더: 브라우저가 스트리밍 이벤트로 해석하도록 지정
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
