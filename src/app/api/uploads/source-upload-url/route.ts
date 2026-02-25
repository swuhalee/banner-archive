import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/server/lib/supabase/admin'
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE } from '@/features/uploads/utils/upload-validation'
import { sourceUploadUrlRateLimiter } from '@/server/lib/rate-limit'

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(request: NextRequest) {
  if (sourceUploadUrlRateLimiter) {
    const clientIp = getClientIp(request)
    const { success } = await sourceUploadUrlRateLimiter.limit(clientIp)
    if (!success) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요' }, { status: 429 })
    }
  }

  let body: { contentType?: string; contentLength?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다' }, { status: 400 })
  }

  const contentType = body.contentType?.trim().toLowerCase()
  if (!contentType || !ALLOWED_UPLOAD_MIME_TYPES.includes(contentType)) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다' }, { status: 400 })
  }

  const contentLength = Number(body.contentLength)
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json({ error: '파일 크기 정보가 올바르지 않습니다' }, { status: 400 })
  }
  if (contentLength > MAX_UPLOAD_FILE_SIZE) {
    return NextResponse.json({ error: '이미지 크기는 20MB를 초과할 수 없습니다' }, { status: 400 })
  }

  const ext = EXTENSION_BY_MIME_TYPE[contentType]
  if (!ext) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다' }, { status: 400 })
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET!
  const path = `sources/raw/${randomUUID()}.${ext}`

  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)

  if (error || !data?.token) {
    return NextResponse.json(
      { error: `업로드 URL 발급에 실패했습니다: ${error?.message ?? '알 수 없는 오류'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    bucket,
    path,
    token: data.token,
    signedUrl: data.signedUrl ?? null,
  })
}
