import { describe, expect, it } from 'vitest'
import {
  getUploadFileValidationError,
  MAX_UPLOAD_FILE_SIZE,
  toFriendlyAnalyzeErrorMessage,
} from './upload-validation'

describe('getUploadFileValidationError', () => {
  it('HEIC 파일은 포맷 변환 안내 메시지를 반환한다', () => {
    const file = new File(['x'], 'photo.heic', { type: 'image/heic' })
    expect(getUploadFileValidationError(file)).toContain('HEIC/HEIF')
  })

  it('지원하지 않는 MIME 타입은 허용 포맷 메시지를 반환한다', () => {
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' })
    expect(getUploadFileValidationError(file)).toBe('JPG, PNG, WebP 이미지만 업로드 가능합니다.')
  })

  it('20MB를 초과하면 용량 제한 메시지를 반환한다', () => {
    const file = new File([new Uint8Array(MAX_UPLOAD_FILE_SIZE + 1)], 'large.jpg', {
      type: 'image/jpeg',
    })
    expect(getUploadFileValidationError(file)).toBe('이미지 크기는 20MB를 초과할 수 없습니다.')
  })

  it('허용된 파일은 null을 반환한다', () => {
    const file = new File(['x'], 'ok.png', { type: 'image/png' })
    expect(getUploadFileValidationError(file)).toBeNull()
  })
})

describe('toFriendlyAnalyzeErrorMessage', () => {
  it('Server Components 마스킹 오류는 일반 안내 문구로 변환한다', () => {
    const error = new Error('An error occurred in the Server Components render.')
    expect(toFriendlyAnalyzeErrorMessage(error)).toBe(
      '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    )
  })

  it('unexpected response 오류는 일반 안내 문구로 변환한다', () => {
    const error = new Error('An unexpected response was received from the server.')
    expect(toFriendlyAnalyzeErrorMessage(error)).toBe(
      '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    )
  })

  it('413 payload 초과 오류는 용량 안내 문구로 변환한다', () => {
    const error = new Error('FUNCTION_PAYLOAD_TOO_LARGE (413)')
    expect(toFriendlyAnalyzeErrorMessage(error)).toBe(
      '업로드 파일이 너무 큽니다. 20MB 이하 이미지로 다시 시도해 주세요.',
    )
  })

  it('일반 에러 메시지는 그대로 유지한다', () => {
    const error = new Error('AI 분석 요청 한도를 초과했습니다')
    expect(toFriendlyAnalyzeErrorMessage(error)).toBe('AI 분석 요청 한도를 초과했습니다')
  })

  it('Error 인스턴스가 아니면 기본 메시지를 반환한다', () => {
    expect(toFriendlyAnalyzeErrorMessage('unknown')).toBe('분석에 실패했습니다')
  })
})
