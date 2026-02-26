export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/*',
]

export const MAX_UPLOAD_FILE_SIZE = 20 * 1024 * 1024

export function getUploadFileValidationError(file: File): string | null {
  const mimeType = file.type.trim().toLowerCase()
  const isImage = mimeType.startsWith('image/')
  const isGif = mimeType === 'image/gif'

  if (!isImage || isGif) {
    return 'GIF를 제외한 이미지 파일만 업로드 가능합니다.'
  }

  return null
}

export function toFriendlyAnalyzeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return '분석에 실패했습니다'

  const message = err.message
  const isMaskedServerActionError =
    message.includes('An error occurred in the Server Components render') ||
    message.includes('An unexpected response was received from the server.')

  const isPayloadTooLargeError =
    message.includes('FUNCTION_PAYLOAD_TOO_LARGE') ||
    message.includes('Request Entity Too Large') ||
    message.includes('413')

  if (isPayloadTooLargeError) {
    return '업로드 파일이 너무 큽니다. 20MB 이하 이미지로 다시 시도해 주세요.'
  }

  if (isMaskedServerActionError) {
    return '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }

  return message
}
