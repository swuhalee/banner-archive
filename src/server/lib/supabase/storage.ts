/**
 * 스토리지 경로(path)를 Supabase public URL로 변환합니다.
 * - 이미 완전한 URL(http/https)이면 그대로 반환 (기존 데이터 하위 호환)
 * - 상대 경로이면 환경변수로 URL을 조립합니다
 */
export function resolveStorageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) return storagePath

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!
  return `${base}/storage/v1/object/public/${bucket}/${storagePath}`
}
