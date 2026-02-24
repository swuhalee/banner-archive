import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  applyPrivacyMask,
  compressToTarget,
  cropImage,
  type AbsoluteBBox,
  type PrivacyRegionRaw,
} from '@/server/lib/image-processing'

async function createSolidImage(width: number, height: number, gray = 255): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: gray, g: gray, b: gray },
    },
  })
    .png()
    .toBuffer()
}

async function getPixel(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels
  const idx = (y * info.width + x) * channels
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
  }
}

describe('compressToTarget', () => {
  it('최대 너비를 지키며 webp로 압축한다', async () => {
    const input = await createSolidImage(2000, 1000)
    const result = await compressToTarget(input, 1200, 400, 82)
    const metadata = await sharp(result).metadata()

    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBeLessThanOrEqual(1200)
    expect(result.length).toBeLessThanOrEqual(400 * 1024)
  })
})

describe('cropImage', () => {
  it('bbox와 패딩을 반영해 이미지를 안전하게 크롭한다', async () => {
    const source = await createSolidImage(100, 100)
    const bbox = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }

    const { buffer, offset } = await cropImage(source, bbox, 100, 100)
    const metadata = await sharp(buffer).metadata()

    expect(offset).toEqual({ x: 35, y: 24, width: 31, height: 53 })
    expect(metadata.width).toBe(31)
    expect(metadata.height).toBe(53)
  })

  it('경계 밖 bbox도 이미지 범위를 넘지 않게 보정한다', async () => {
    const source = await createSolidImage(100, 100)
    const bbox = { x: -0.2, y: -0.2, width: 0.1, height: 0.1 }

    const { buffer, offset } = await cropImage(source, bbox, 100, 100)
    const metadata = await sharp(buffer).metadata()

    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
    expect(offset.width).toBeGreaterThanOrEqual(1)
    expect(offset.height).toBeGreaterThanOrEqual(1)
    expect(metadata.width).toBe(offset.width)
    expect(metadata.height).toBe(offset.height)
  })
})

describe('applyPrivacyMask', () => {
  it('개인정보 영역이 없으면 원본 크롭 이미지를 그대로 반환한다', async () => {
    const crop = await createSolidImage(100, 100)
    const cropOffset: AbsoluteBBox = { x: 50, y: 50, width: 100, height: 100 }

    const result = await applyPrivacyMask(crop, cropOffset, [], 200, 200)

    expect(result.buffer).toBe(crop)
    expect(result.appliedRegions).toEqual([])
  })

  it('겹치는 개인정보 영역에 검은 박스 마스킹을 적용한다', async () => {
    const crop = await createSolidImage(100, 100)
    const cropOffset: AbsoluteBBox = { x: 50, y: 50, width: 100, height: 100 }
    const regions: PrivacyRegionRaw[] = [
      {
        type: 'face',
        bbox: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
      },
    ]

    const { buffer, appliedRegions } = await applyPrivacyMask(crop, cropOffset, regions, 200, 200)
    const maskedPixel = await getPixel(buffer, 35, 35)
    const plainPixel = await getPixel(buffer, 5, 5)

    expect(appliedRegions).toEqual([{ x: 30, y: 30, width: 40, height: 40 }])
    expect(maskedPixel).toEqual({ r: 0, g: 0, b: 0 })
    expect(plainPixel).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('크롭 영역과 겹치지 않는 개인정보 영역은 무시한다', async () => {
    const crop = await createSolidImage(100, 100)
    const cropOffset: AbsoluteBBox = { x: 0, y: 0, width: 100, height: 100 }
    const regions: PrivacyRegionRaw[] = [
      {
        type: 'licensePlate',
        bbox: { x: 3, y: 3, width: 0.1, height: 0.1 },
      },
    ]

    const { buffer, appliedRegions } = await applyPrivacyMask(crop, cropOffset, regions, 50, 50)

    expect(buffer).toBe(crop)
    expect(appliedRegions).toEqual([])
  })
})
