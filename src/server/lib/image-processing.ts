import type { BBox } from '@/features/uploads/types/upload'
import sharp from 'sharp'

/*
  이미지 압축 함수: 입력 버퍼를 받아, 최대 너비와 목표 용량(KB)에 맞게 WebP로 압축함
    -> WebP는 같은 품질에서 JPEG보다 용량이 작게 나오는 경우가 많아서 최종 저장 용량을 줄이는 데 유리함!

  - maxWidth: 이미지의 최대 너비 (예: 썸네일은 1200, 상세 이미지는 2400)
  - targetMaxKB: 목표 최대 용량 (예: 썸네일은 400KB, 상세 이미지는 1200KB)
  - startQuality: 압축 품질 초기값 (기본 82, 필요시 조정)

  압축 과정:
  1. 주어진 품질로 WebP 변환 후 크기를 확인한다.
  2. 목표 용량 이하이거나 품질이 30 이하가 될 때까지 품질을 단계적으로 낮춘다.
  3. 반복 후에도 크면 최저 품질(30)로 한 번 더 만들어 반환한다.

  이 함수는 sharp 라이브러리를 사용하여 이미지 처리와 압축을 수행한다.
*/
export async function compressToTarget(
  input: Buffer,
  maxWidth: number,
  targetMaxKB: number,
  startQuality = 82,
): Promise<Buffer> {
  // 품질(quality)을 단계적으로 낮추면서 목표 용량 이하가 되는 지점을 찾는다.
  let quality = startQuality

  for (let attempt = 0; attempt < 6; attempt++) {
    // fit: 'inside' --> 지정한 maxWidth 안에 이미지가 들어오도록 비율 유지 축소
    // withoutEnlargement: true --> 원본보다 작은 경우 확대하지 않음 (품질 저하 방지)
    // 요약: 최대 너비 제한은 지키되 비율은 유지하고, 작은 이미지는 확대 X
    const result = await sharp(input)
      .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer()

    // 목표 KB 이하가 되었거나, 품질 하한선(30)까지 내려갔다면 종료
    if (result.length <= targetMaxKB * 1024 || quality <= 30) return result
    quality = Math.max(30, quality - 8)
  }

  // 반복 시도 후에도 크면 최저 품질로 한 번 더 만들어 반환
  return sharp(input)
    .resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 30, effort: 4 })
    .toBuffer()
}

// bbox: Bounding Box --> 현수막 위치를 사각형으로 표시할 때 쓰는 좌표
export type AbsoluteBBox = { x: number; y: number; width: number; height: number }
// 개인정보 가릴 영역
export type PrivacyRegionRaw = {
  type: string
  bbox: { x: number; y: number; width: number; height: number }
}

export async function cropImage(
  rotatedBuffer: Buffer,
  bbox: BBox,
  imgWidth: number,
  imgHeight: number,
): Promise<{ buffer: Buffer; offset: AbsoluteBBox }> {
  // 수평: bbox 너비의 25% 여백 → 1.5배 폭
  const padX = bbox.width * 0.25
  // 수직: AI 인식이 실제보다 bbox 높이의 ~50% 아래에 치우쳐 있으므로
  //   - 상단 = 오프셋 보정(0.5) + 여백(0.25) = 0.75배 위로
  //   - 하단 = 여백(0.5) → 총 크롭 높이 ≈ 2.25배
  const topPad = bbox.height * 0.8
  const bottomPad = bbox.height * 0.8

  // bbox는 0~1 비율 좌표이므로 실제 픽셀 좌표로 변환한다.
  const left = Math.max(0, Math.floor((bbox.x - padX) * imgWidth))
  const top = Math.max(0, Math.floor((bbox.y - topPad) * imgHeight))
  const right = Math.min(imgWidth, Math.ceil((bbox.x + bbox.width + padX) * imgWidth))
  const bottom = Math.min(imgHeight, Math.ceil((bbox.y + bbox.height + bottomPad) * imgHeight))

  // sharp.extract는 1픽셀 이상이 필요하므로 최소 1 보장
  const cropWidth = Math.max(1, right - left)
  const cropHeight = Math.max(1, bottom - top)

  // sharp.extract: 이미지에서 지정한 영역(left, top, width, height)만큼 잘라내는 함수
  const buffer = await sharp(rotatedBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer()

  return { buffer, offset: { x: left, y: top, width: cropWidth, height: cropHeight } }
}

// 검정 박스 버퍼 생성
async function blackBoxRegion(region: AbsoluteBBox): Promise<Buffer | null> {
  const { width, height } = region
  // 마스킹 영역이 비정상이면 건너뛴다.
  if (width <= 0 || height <= 0) return null
  // 검은 사각형 이미지를 만든 뒤 원본 위에 덮어쓰는 방식으로 마스킹한다.
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer()
}

// 크롭된 이미지에 개인정보 영역을 찾아 검은 박스 마스킹을 적용하는 함수
export async function applyPrivacyMask(
  cropBuffer: Buffer,
  cropOffset: AbsoluteBBox,
  privacyRegions: PrivacyRegionRaw[],
  sourceWidth: number,
  sourceHeight: number,
): Promise<{ buffer: Buffer; appliedRegions: AbsoluteBBox[] }> {
  // 개인정보 영역이 없으면 원본 크롭 이미지를 그대로 반환
  if (privacyRegions.length === 0) return { buffer: cropBuffer, appliedRegions: [] }

  const composites: sharp.OverlayOptions[] = []
  const appliedRegions: AbsoluteBBox[] = []

  for (const region of privacyRegions) {
    // 소스 이미지 비율 좌표 -> 크롭 이미지 기준 픽셀 좌표로 변환
    const relX = Math.round(region.bbox.x * sourceWidth - cropOffset.x)
    const relY = Math.round(region.bbox.y * sourceHeight - cropOffset.y)
    const relW = Math.round(region.bbox.width * sourceWidth)
    const relH = Math.round(region.bbox.height * sourceHeight)

    // 크롭 영역과 교차하는 부분만 처리
    const clampedX = Math.max(0, relX)
    const clampedY = Math.max(0, relY)
    const clampedW = Math.min(cropOffset.width, relX + relW) - clampedX
    const clampedH = Math.min(cropOffset.height, relY + relH) - clampedY

    const pixelated = await blackBoxRegion({ x: clampedX, y: clampedY, width: clampedW, height: clampedH })
    if (pixelated) {
      // composite 배열에 모아두었다가 마지막에 한 번에 적용한다.
      composites.push({ input: pixelated, left: clampedX, top: clampedY })
      appliedRegions.push({ x: clampedX, y: clampedY, width: clampedW, height: clampedH })
    }
  }

  if (composites.length === 0) return { buffer: cropBuffer, appliedRegions: [] }

  const maskedBuffer = await sharp(cropBuffer).composite(composites).toBuffer()
  return { buffer: maskedBuffer, appliedRegions }
}
