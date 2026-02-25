import { z } from 'zod'
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE } from '@/features/uploads/utils/upload-validation'

export { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE }

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
  sourcePath: z
    .string()
    .trim()
    .min(1, 'sourcePath는 필수입니다')
    .refine((value) => /^sources\/raw\/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp)$/i.test(value), {
      message: 'sourcePath 형식이 올바르지 않습니다',
    }),
  sourceContentType: z
    .string()
    .trim()
    .refine((value) => ALLOWED_UPLOAD_MIME_TYPES.includes(value), {
      message: 'JPG, PNG, WebP 이미지만 업로드 가능합니다 (HEIC/HEIF 미지원)',
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

const privacyRegionSchema = z.object({
  type: z.enum(['face', 'licensePlate']),
  bbox: z.object({
    x: z.coerce.number(),
    y: z.coerce.number(),
    width: z.coerce.number(),
    height: z.coerce.number(),
  }),
})

export const detectedBannerListSchema = z
  .object({
    banners: z.array(detectedBannerSchema).default([]),
    privacyRegions: z.array(privacyRegionSchema).default([]),
  })
  .passthrough()
