import { z } from 'zod'

export const ALLOWED_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const MAX_UPLOAD_FILE_SIZE = 20 * 1024 * 1024 // 20MB

const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))

const requiredDateStringSchema = z
  .string()
  .trim()
  .min(1, 'observedAt은 필수입니다')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'observedAt 날짜 형식이 올바르지 않습니다 (ISO 8601)',
  })

export const analyzeBannerInputSchema = z.object({
  image: z
    .instanceof(File, { message: 'image 파일이 필요합니다' })
    .refine((file) => ALLOWED_UPLOAD_MIME_TYPES.includes(file.type), {
      message: 'JPG, PNG, WebP 이미지만 업로드 가능합니다',
    })
    .refine((file) => file.size <= MAX_UPLOAD_FILE_SIZE, {
      message: '이미지 크기는 20MB를 초과할 수 없습니다',
    }),
  regionText: z.string().trim().min(1, 'regionText는 필수입니다'),
  observedAt: requiredDateStringSchema,
  subjectType: optionalTrimmedStringSchema.optional(),
})

const detectedBannerSchema = z
  .object({
    tempId: z.string().optional(),
    title: z.string().nullable().optional(),
    hashtags: z.array(z.string()).optional(),
    subjectType: z.string().nullable().optional(),
    bbox: z
      .object({
        x: z.coerce.number().optional(),
        y: z.coerce.number().optional(),
        width: z.coerce.number().optional(),
        height: z.coerce.number().optional(),
      })
      .optional(),
    confidence: z.coerce.number().optional(),
  })
  .passthrough()

export const detectedBannerListSchema = z
  .object({
    banners: z.array(detectedBannerSchema).default([]),
  })
  .passthrough()
