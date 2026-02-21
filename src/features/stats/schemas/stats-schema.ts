import { z } from 'zod'

const optionalTrimmedStringSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : undefined))

const optionalDateStringSchema = optionalTrimmedStringSchema.refine(
  (value) => value === undefined || !Number.isNaN(new Date(value).getTime()),
  {
    message: '날짜 형식이 올바르지 않습니다 (ISO 8601)',
  },
)

export const statsParamsSchema = z.object({
  from: optionalDateStringSchema.optional(),
  to: optionalDateStringSchema.optional(),
  region: optionalTrimmedStringSchema.optional(),
  subjectType: optionalTrimmedStringSchema.optional(),
  hashtag: optionalTrimmedStringSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type StatsParams = z.infer<typeof statsParamsSchema>
