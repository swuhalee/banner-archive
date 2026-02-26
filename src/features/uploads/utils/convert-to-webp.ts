import { MAX_UPLOAD_FILE_SIZE } from './upload-validation'

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif'])
const WEBP_QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34]
const RESIZE_SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]

/**
 * HEIC/HEIF 파일을 JPEG Blob으로 변환합니다. (heic-convert/browser 사용)
 */
async function heicToJpegBlob(heicFile: File): Promise<Blob> {
  const heicConvertModule = await import('heic-convert/browser')
  const heicConvert = (
    typeof heicConvertModule.default === 'function'
      ? heicConvertModule.default
      : heicConvertModule
  ) as (args: { buffer: Uint8Array; format: 'JPEG'; quality: number }) => Promise<ArrayBuffer | Uint8Array>

  const input = new Uint8Array(await heicFile.arrayBuffer())
  const output = await heicConvert({
    buffer: input,
    format: 'JPEG',
    quality: 0.92,
  })
  // BlobPart 타입 호환을 위해 ArrayBuffer 기반 Uint8Array로 한 번 복사
  const outputUint8 = output instanceof Uint8Array ? output : new Uint8Array(output)
  const outputCopy = new Uint8Array(outputUint8)
  return new Blob([outputCopy], { type: 'image/jpeg' })
}

/**
 * Blob을 Canvas API로 WebP File로 변환합니다.
 * - EXIF 방향 정보는 브라우저가 렌더링 시 자동 적용하므로 별도 처리 불필요
 * - WebP 인코딩을 지원하지 않는 브라우저에서는 에러를 던집니다
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지를 불러올 수 없습니다.'))
    }

    img.src = objectUrl
  })
}

function imageToWebP(
  image: HTMLImageElement,
  originalName: string,
  quality: number,
  scale: number,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('이미지 변환에 실패했습니다.'))
      return
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (outBlob) => {
        if (!outBlob) {
          reject(new Error('이미지 변환에 실패했습니다.'))
          return
        }
        if (outBlob.type !== 'image/webp') {
          reject(new Error('브라우저가 WebP 변환을 지원하지 않습니다.'))
          return
        }
        const webpName = originalName.replace(/\.[^.]+$/, '.webp')
        resolve(new File([outBlob], webpName, { type: 'image/webp' }))
      },
      'image/webp',
      quality,
    )
  })
}

/**
 * 이미지 파일을 WebP로 변환합니다.
 * - JPEG / PNG / WebP: Canvas API로 직접 변환
 * - HEIC / HEIF: heic-convert로 JPEG 변환 후 Canvas API로 WebP 변환
 */
export async function convertToWebP(file: File): Promise<File> {
  if (file.type === 'image/webp' && file.size <= MAX_UPLOAD_FILE_SIZE) {
    return file
  }

  let image: HTMLImageElement
  if (HEIC_MIME_TYPES.has(file.type)) {
    try {
      const jpegBlob = await heicToJpegBlob(file)
      image = await loadImageFromBlob(jpegBlob)
    } catch {
      try {
        image = await loadImageFromBlob(file)
      } catch {
        throw new Error('HEIC/HEIF 파일을 읽을 수 없습니다. 다른 이미지로 다시 시도해 주세요.')
      }
    }
  } else {
    image = await loadImageFromBlob(file)
  }

  // scale × quality 조합을 순서대로 시도해 처음으로 크기 조건을 만족하는 파일 반환
  // 모든 조합(최대 56회)이 실패하면 → 변환 자체는 성공했지만 크기 제한을 충족할 수 없다는 뜻
  for (const scale of RESIZE_SCALE_STEPS) {
    for (const quality of WEBP_QUALITY_STEPS) {
      const webpFile = await imageToWebP(image, file.name, quality, scale)
      if (webpFile.size <= MAX_UPLOAD_FILE_SIZE) return webpFile
    }
  }

  throw new Error('변환 후에도 이미지 크기가 20MB를 초과합니다. 더 작은 이미지를 사용해 주세요.')
}
