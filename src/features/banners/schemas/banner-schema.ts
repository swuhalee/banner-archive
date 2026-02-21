import { z } from 'zod'

const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))

const dateStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: '날짜 형식이 올바르지 않습니다 (ISO 8601)',
  })

const optionalDateStringSchema = optionalTrimmedStringSchema.refine(
  (value) => value === undefined || !Number.isNaN(new Date(value).getTime()),
  {
    message: '날짜 형식이 올바르지 않습니다 (ISO 8601)',
  },
)

export const bannerIdSchema = z.string().trim().min(1, 'banner id가 필요합니다')

export const bannerListParamsSchema = z.object({
  q: optionalTrimmedStringSchema.optional(),
  from: optionalDateStringSchema.optional(),
  to: optionalDateStringSchema.optional(),
  hashtag: optionalTrimmedStringSchema.optional(),
  region: optionalTrimmedStringSchema.optional(),
  subjectType: optionalTrimmedStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const createBannerInputSchema = z
  .object({
    title: optionalTrimmedStringSchema.optional(),
    hashtags: z
      .array(z.string().trim())
      .optional()
      .transform((value) => value?.filter((tag) => tag.length > 0) ?? []),
    subjectType: optionalTrimmedStringSchema.optional(),
    regionText: z.string().trim().min(1, 'regionText는 필수입니다'),
    firstSeenAt: dateStringSchema,
    lastSeenAt: dateStringSchema,
  })
  .refine(
    (value) => new Date(value.firstSeenAt).getTime() <= new Date(value.lastSeenAt).getTime(),
    {
      message: 'firstSeenAt은 lastSeenAt보다 이전이어야 합니다',
      path: ['firstSeenAt'],
    },
  )

export const appealReasonTypes = ['privacy', 'portrait', 'false_info', 'other'] as const
export const appealReasonTypeSchema = z.enum(appealReasonTypes)

export const submitAppealInputSchema = z.object({
  bannerId: bannerIdSchema,
  reasonType: appealReasonTypeSchema,
  reasonDetail: optionalTrimmedStringSchema.optional(),
})

export type BannerListParams = z.infer<typeof bannerListParamsSchema>
export type CreateBannerInput = z.infer<typeof createBannerInputSchema>
export type AppealReasonType = z.infer<typeof appealReasonTypeSchema>
export type SubmitAppealInput = z.infer<typeof submitAppealInputSchema>
