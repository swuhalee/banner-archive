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

/*
  이 파일의 역할
  - 사용자가 업로드 화면에서 "저장"을 누르면 이 API가 호출
  - 선택한 후보들을 중복 검사하고, 이미지 가공/업로드 후 DB에 저장
  - 작업이 길 수 있어서 SSE로 진행률(progress)을 계속 보내줌!
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
export async function POST(request: NextRequest) {
  // 1) 요청 본문(JSON) 파싱 + 필수값 검증 --> 잘못된 요청은 바로 400으로 종료
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

  // 2) SSE 스트림 준비 --> 일반 JSON 응답과 달리, 작업 중간 상태를 여러 번 나눠서 보낼 수 있음!
  // ReadableStream: 스트림 객체로 controller.enqueue로 데이터 넣고 controller.close로 종료
  const stream = new ReadableStream({
    async start(controller) {
      // 클라이언트가 EventSource로 읽을 수 있는 "data: ...\n\n" 포맷 전송 도우미
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 3) 업로드 원본 메타데이터 조회 --> 다음 단계의 중복 비교/이미지 처리에 필요한 데이터를 가져옴
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

        // 4) 중복 판정 --> 기존 active 배너와 비교해 임계치 이상이면 저장 대상에서 제외
        send({ progress: 8 })

        const observedAt = uploadSource.observedAt
        const regionText = uploadSource.regionText

        // 중복 비교 대상을 불러옴 (같은 지역의 활성 배너만)
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
          .where(and(eq(banners.status, 'active'), eq(banners.regionText, regionText)))

        const rejectedDuplicates: RejectedDuplicate[] = []
        const nonDuplicates: CommitCandidate[] = []

        // 사용자가 고른 후보를 하나씩 중복 검사한다.
        for (const candidate of selectedCandidates) {
          const best = findBestMatch(candidate, observedAt, existingBanners)
          // console.log(
          //   `[dedup] 후보 "${candidate.title}" → 최고 유사도: ${best ? `${best.similarityScore.toFixed(1)}% (bannerId: ${best.matchedBannerId})` : '없음 (기존 배너 0건)'}`,
          // )
          // 임계치 이상이면 "중복으로 제외", 아니면 "저장 대상"으로 분리
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
            },
          })
          controller.close()
          return
        }

        // 이후 진행률 계산에 사용
        const total = nonDuplicates.length

        // 5) 원본 이미지 다운로드 + 회전(EXIF) 보정 --> bbox는 이미지 방향이 맞아야 정확하게 크롭됨
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

        // 업로드 원본 이미지를 메모리(Buffer)로 읽음
        const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer())
        // EXIF 회전 정보를 실제 픽셀에 반영해, 이후 bbox 계산 오차를 줄임
        const rotatedBuffer = await sharp(sourceBuffer).rotate().toBuffer()
        const { width: srcWidth = 1, height: srcHeight = 1 } = await sharp(rotatedBuffer).metadata()
        const rawPrivacyRegions = (uploadSource.privacyRegionsJson ?? []) as PrivacyRegionRaw[]
        // console.log(`[mask-debug] privacyRegions from DB: ${rawPrivacyRegions.length}건`, JSON.stringify(rawPrivacyRegions))
        // console.log(`[mask-debug] source image size: ${srcWidth}x${srcHeight}`)
        send({ progress: 20 })

        // 6) 각 후보를 병렬 처리: 크롭 -> 개인정보 마스킹 -> 썸네일/상세 압축 -> 스토리지 업로드
        type CropUploadResult = {
          candidate: CommitCandidate
          thumbPath: string
          detailPath: string
          appliedRegions: AbsoluteBBox[]
        }

        let completed = 0
        const cropResults: CropUploadResult[] = await Promise.all(
          nonDuplicates.map(async (candidate) => {
            // 후보 bbox 기준으로 크롭
            const { buffer: cropBuffer, offset: cropOffset } = await cropImage(rotatedBuffer, candidate.bbox, srcWidth, srcHeight)
            // 개인정보 영역(예: 얼굴/차량번호판)을 검은 박스로 가림
            const { buffer: maskedBuffer, appliedRegions } = await applyPrivacyMask(cropBuffer, cropOffset, rawPrivacyRegions, srcWidth, srcHeight)

            // 같은 이미지에서 썸네일/상세용 2가지 크기를 생성
            const [thumbBuffer, detailBuffer] = await Promise.all([
              compressToTarget(maskedBuffer, 1200, 400, 78),
              compressToTarget(maskedBuffer, 2400, 1200, 85),
            ])

            const cropId = randomUUID()
            const thumbPath = `${cropId}-thumb.webp`
            const detailPath = `${cropId}-detail.webp`

            // 스토리지 업로드도 병렬 처리해 시간을 줄임
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

        // 7) DB 저장 (트랜잭션) --> banners / images / banner_sources 를 한 묶음으로 저장함
        send({ progress: 92 })

        // 트랜잭션으로 묶어, 중간 실패 시 일부만 저장되는 상황을 방지함
        const insertedBannerIds = await db.transaction(async (tx) => {
          const ids: string[] = []

          for (const { candidate, thumbPath, detailPath, appliedRegions } of cropResults) {
            // 1) banners 테이블에 기본 정보 저장
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

            // 2) images 테이블에 이미지 경로/마스킹 메타데이터 저장
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

            // 3) banner_sources 테이블에 원본 업로드와의 연결 정보 저장
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

        // 8) 완료 응답 --> 저장된 ID 목록과 중복으로 제외된 목록을 함께 반환함
        send({
          progress: 100,
          done: true,
          data: {
            savedBannerIds: insertedBannerIds,
            rejectedDuplicates,
            savedCount: insertedBannerIds.length,
            rejectedCount: rejectedDuplicates.length,
          },
        })
        controller.close()
      } catch (err) {
        // 처리 중 어느 단계에서든 예외가 나면 SSE로 오류를 전달
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
