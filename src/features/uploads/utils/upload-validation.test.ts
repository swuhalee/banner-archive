import { describe, expect, it } from 'vitest'
import {
  getUploadFileValidationError,
  toFriendlyAnalyzeErrorMessage,
} from './upload-validation'

describe('getUploadFileValidationError', () => {
  it('HEIC 파일은 허용한다', () => {
    const file = new File(['x'], 'photo.heic', { type: 'image/heic' })
    expect(getUploadFileValidationError(file)).toBeNull()
  })

  it('GIF 파일은 차단한다', () => {
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' })
    expect(getUploadFileValidationError(file)).toBe('GIF를 제외한 이미지 파일만 업로드 가능합니다.')
  })

  it('이미지가 아닌 파일은 차단한다', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    expect(getUploadFileValidationError(file)).toBe('GIF를 제외한 이미지 파일만 업로드 가능합니다.')
  })

  it('용량이 커도 이미지 포맷이면 사전 검증은 통과한다', () => {
    const file = new File([new Uint8Array(21 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    })
    expect(getUploadFileValidationError(file)).toBeNull()
  })

  it('허용된 파일은 null을 반환한다', () => {
    const file = new File(['x'], 'ok.avif', { type: 'image/avif' })
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
